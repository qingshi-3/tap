import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ORDERS, TRUCKS, getOrder } from '../js/content.js';
import { canPlace, cellsFor, inspect, unloadPath } from '../js/engine.js';
import { SAVE_KEY, BACKUP_KEY, freshSave, validateSave, loadSave, createStore, settleOrder, buyTruck } from '../js/persistence.js';

const copy = value => JSON.parse(JSON.stringify(value));
class MemoryStorage {
  data = new Map();
  writes = [];
  failure = null;
  getItem(key) {
    if (this.failure === 'read') throw new Error('read unavailable');
    return this.data.get(key) ?? null;
  }
  setItem(key, value) {
    if (this.failure === key) throw new Error('storage full');
    this.writes.push(key);
    this.data.set(key, String(value));
  }
}
function active(order = ORDERS[0], overrides = {}) {
  return { orderId: order.id, contentVersion: 2, placements: {}, phase: 'loading', stop: 0, delivered: [], moves: 0, hints: 0, paid: false, ...overrides };
}
const legacyRaw = phase => readFileSync(new URL(`./fixtures/save-v1-${phase}.json`, import.meta.url), 'utf8');
function readyToSettle(order = ORDERS[0]) {
  const save = freshSave();
  save.active = active(order, { phase: 'unloading', stop: order.stops.length - 1, delivered: order.cargo.map(cargo => cargo.id) });
  return save;
}

test('fresh saves are independent and use the fixed persistent key', () => {
  assert.equal(SAVE_KEY, 'cargo-packer.save.v1');
  assert.equal(BACKUP_KEY, 'cargo-packer.save.v1.backup');
  const a = freshSave(), b = freshSave();
  assert.equal(b.schema, 2);
  a.ownedTrucks.push('box');
  assert.deepEqual(b.ownedTrucks, [TRUCKS[0].id]);
  assert.equal(validateSave(b), b);
  const storage = new MemoryStorage();
  const store = createStore(storage);
  const { save, raw, error } = store.load();
  assert.equal(raw, null);
  assert.equal(error, null);
  const saved = store.save(save);
  assert.equal(saved.revision, 1);
  assert.equal(save.revision, 0);
  assert.deepEqual(storage.writes, [SAVE_KEY]);
});

test('load, place, reload, continue loading, unload, settle and continue saving', () => {
  const storage = new MemoryStorage();
  let store = createStore(storage);
  let save = store.load().save;
  const order = ORDERS[0];
  save.active = active(order);
  for (const [index, cargo] of order.cargo.entries()) {
    const placement = order.solution[cargo.id];
    assert.equal(canPlace(order, save.active.placements, cargo.id, placement.x, placement.y, placement.r, placement.z ?? 0).ok, true);
    save.active.placements[cargo.id] = { ...placement };
    save.active.moves++;
    save = store.save(save);
    if (index === 0) {
      store = createStore(storage);
      save = store.load().save;
      assert.equal(save.active.moves, 1);
      assert.deepEqual(save.active.placements[cargo.id], placement);
    }
  }
  assert.equal(inspect(order, save.active.placements).ready, true);
  save.active.phase = 'unloading';
  save = store.save(save);
  while (save.active.delivered.length < order.cargo.length) {
    const cargo = order.cargo.find(item => save.active.placements[item.id] && unloadPath(order, save.active.placements, item.id));
    assert.ok(cargo, 'a physically reachable piece exists');
    delete save.active.placements[cargo.id];
    save.active.delivered.push(cargo.id);
    save = store.save(save);
    store = createStore(storage);
    save = store.load().save;
  }
  settleOrder(save, 3);
  save = store.save(save);
  store = createStore(storage);
  const result = store.load();
  assert.equal(result.error, null);
  assert.equal(result.save.active.phase, 'result');
  assert.equal(result.save.coins, order.reward + 30);
  result.save.sound = false;
  const continued = store.save(result.save);
  assert.equal(loadSave(storage).save.sound, false);
  assert.equal(continued.revision, result.save.revision + 1);
  assert.ok(storage.data.has(BACKUP_KEY));
  assert.deepEqual(new Set(storage.writes), new Set([SAVE_KEY, BACKUP_KEY]));
});

test('first completion pays once; duplicate settlement and replays cannot farm coins', () => {
  const save = readyToSettle();
  settleOrder(save, 1);
  const first = copy(save);
  settleOrder(save, 3);
  assert.deepEqual(save, first);
  save.active = readyToSettle().active;
  settleOrder(save, 3);
  assert.equal(save.coins, first.coins);
  assert.equal(save.completed[ORDERS[0].id].stars, 3);
  assert.equal(save.completed[ORDERS[0].id].reward, ORDERS[0].reward + 10);
});

test('incomplete or invalid settlement does not partially mutate state', () => {
  const save = freshSave();
  save.active = active();
  const before = copy(save);
  assert.throws(() => settleOrder(save, 3), { code: 'ORDER_INCOMPLETE' });
  assert.throws(() => settleOrder(save, 0), { code: 'INVALID_STARS' });
  assert.deepEqual(save, before);
});

test('buying enforces progress, price and existing ownership without partial mutation', () => {
  const save = freshSave();
  save.coins = 5000;
  const initial = copy(save);
  assert.throws(() => buyTruck(save, 'box'), { code: 'TRUCK_LOCKED' });
  assert.deepEqual(save, initial);
  for (const order of ORDERS.slice(0, 5)) save.completed[order.id] = { stars: 1, reward: order.reward + 10 };
  save.coins = TRUCKS[1].price - 1;
  const insufficient = copy(save);
  assert.throws(() => buyTruck(save, 'box'), { code: 'INSUFFICIENT_COINS' });
  assert.deepEqual(save, insufficient);
  save.coins++;
  buyTruck(save, 'box');
  assert.equal(save.coins, 0);
  assert.ok(save.ownedTrucks.includes('box'));
  assert.throws(() => buyTruck(save, 'box'), { code: 'ALREADY_OWNED' });
  assert.throws(() => buyTruck(save, 'unknown'), { code: 'UNKNOWN_TRUCK' });
  assert.equal(validateSave(save), save);
});

test('schema validation rejects unknown IDs, unsafe values and invalid phases', () => {
  const mutations = [
    save => { save.schema = 3; },
    save => { save.revision = Number.MAX_SAFE_INTEGER + 1; },
    save => { save.coins = -1; },
    save => { save.ownedTrucks.push('future-truck'); },
    save => { save.ownedTrucks.push(save.ownedTrucks[0]); },
    save => { save.completed.unknown = { stars: 1, reward: 1 }; },
    save => { save.completed.o01 = { stars: 4, reward: 1 }; },
    save => { save.active = active(undefined, { orderId: 'future-order' }); },
    save => { save.active = active(undefined, { phase: 'driving' }); },
    save => { save.active = active(undefined, { paid: true }); },
    save => { save.active = active(undefined, { hints: -1 }); },
    save => { save.active = active(undefined, { stop: 100 }); },
    save => { save.active = active(undefined, { placements: { unknown: { x: 0, y: 0, r: 0 } } }); },
    save => { save.active = active(undefined, { delivered: ['unknown'] }); },
    save => { save.active = active(ORDERS[5]); },
  ];
  for (const mutation of mutations) {
    const save = freshSave();
    mutation(save);
    assert.throws(() => validateSave(save), { code: 'INVALID_SAVE' });
  }
});

test('placement validation rejects collisions, out-of-bounds, obstacles and rotations', () => {
  const order = ORDERS[0];
  const mutations = [
    placements => { placements[order.cargo[0].id].x = 99; },
    placements => { placements[order.cargo[0].id].r = 4; },
    placements => { placements[order.cargo[0].id].x = 0.5; },
    placements => { placements[order.cargo[1].id] = { x: 0, y: 0, r: 0 }; },
  ];
  for (const mutation of mutations) {
    const save = freshSave();
    save.active = active(order, { placements: copy(order.solution) });
    mutation(save.active.placements);
    assert.throws(() => validateSave(save), { code: 'INVALID_SAVE' });
  }
  const blockedOrder = ORDERS.find(item => item.obstacles.length);
  const save = freshSave();
  save.ownedTrucks.push(blockedOrder.truckId);
  const [x, y] = blockedOrder.obstacles[0];
  save.active = active(blockedOrder, { placements: { [blockedOrder.cargo[0].id]: { x, y, r: 0 } } });
  assert.throws(() => validateSave(save), { code: 'INVALID_SAVE' });
});

test('delivery consistency enforces previous/current/future stations and result receipts', () => {
  const order = ORDERS.find(item => item.stops.length > 1);
  const save = freshSave();
  if (!save.ownedTrucks.includes(order.truckId)) save.ownedTrucks.push(order.truckId);
  save.active = active(order, { phase: 'unloading', placements: copy(order.solution) });
  validateSave(save);
  const futureCargo = order.cargo.find(cargo => cargo.stop > 0);
  save.active.delivered.push(futureCargo.id);
  delete save.active.placements[futureCargo.id];
  assert.throws(() => validateSave(save), { code: 'INVALID_SAVE' });
  save.active = active(order, { phase: 'unloading', stop: 1, placements: copy(order.solution) });
  assert.throws(() => validateSave(save), { code: 'INVALID_SAVE' });
  for (const cargo of order.cargo.filter(item => item.stop === 0)) {
    save.active.delivered.push(cargo.id);
    delete save.active.placements[cargo.id];
  }
  validateSave(save);
  const cargo = order.cargo.find(item => item.stop === 1);
  delete save.active.placements[cargo.id];
  assert.throws(() => validateSave(save), { code: 'INVALID_SAVE' });
  const result = readyToSettle();
  result.active.phase = 'result';
  result.active.paid = true;
  assert.throws(() => validateSave(result), { code: 'INVALID_SAVE' });
});

test('corrupt, null and future saves are preserved and block writes', () => {
  for (const raw of ['{broken', 'null', JSON.stringify({ ...freshSave(), schema: 999 })]) {
    const storage = new MemoryStorage();
    storage.data.set(SAVE_KEY, raw);
    storage.data.set(BACKUP_KEY, 'existing backup');
    const store = createStore(storage);
    const result = store.load();
    assert.equal(result.save, null);
    assert.ok(result.error);
    assert.equal(result.raw, raw);
    assert.equal(store.exportRaw(), raw);
    assert.throws(() => store.save(freshSave()));
    assert.equal(storage.data.get(SAVE_KEY), raw);
    assert.equal(storage.data.get(BACKUP_KEY), 'existing backup');
    assert.deepEqual(storage.writes, []);
  }
});

test('backup failure aborts the main write; explicit reload permits a later retry', () => {
  const storage = new MemoryStorage();
  const store = createStore(storage);
  const initial = store.save(store.load().save);
  const raw = storage.data.get(SAVE_KEY);
  initial.sound = false;
  storage.failure = BACKUP_KEY;
  assert.throws(() => store.save(initial), /storage full/);
  assert.equal(storage.data.get(SAVE_KEY), raw);
  assert.equal(store.exportRaw(), raw);
  assert.ok(store.error);
  storage.failure = null;
  assert.throws(() => store.save(initial), /storage full/);
  const reread = store.load().save;
  reread.sound = false;
  store.save(reread);
  assert.equal(storage.data.get(BACKUP_KEY), raw);
  assert.equal(loadSave(storage).save.sound, false);
});

test('main write failure retains the previous primary and its readable backup', () => {
  const storage = new MemoryStorage();
  const store = createStore(storage);
  const save = store.save(store.load().save);
  const raw = storage.data.get(SAVE_KEY);
  save.coins++;
  storage.failure = SAVE_KEY;
  assert.throws(() => store.save(save), /storage full/);
  assert.equal(storage.data.get(SAVE_KEY), raw);
  assert.equal(storage.data.get(BACKUP_KEY), raw);
  assert.equal(store.exportRaw(), raw);
});

test('storage read failure is reported without generating replacement data', () => {
  const storage = new MemoryStorage();
  storage.failure = 'read';
  const store = createStore(storage);
  const result = store.load();
  assert.equal(result.save, null);
  assert.match(result.error.message, /read unavailable/);
  assert.throws(() => store.save(freshSave()), /read unavailable/);
  assert.deepEqual(storage.writes, []);
});

test('a browser-denied localStorage accessor is reported through load', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('access denied'); } });
    assert.match(loadSave().error.message, /access denied/);
    const store = createStore();
    assert.match(store.load().error.message, /access denied/);
    assert.throws(() => store.save(freshSave()), /access denied/);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('a tab conflict preserves external changes and requires an explicit reread', () => {
  const storage = new MemoryStorage();
  const first = createStore(storage), second = createStore(storage);
  const a = first.load().save, b = second.load().save;
  a.coins = 12;
  first.save(a);
  const raw = storage.data.get(SAVE_KEY);
  b.coins = 99;
  assert.throws(() => second.save(b), { code: 'SAVE_CONFLICT' });
  assert.equal(second.exportRaw(), raw);
  assert.equal(storage.data.get(SAVE_KEY), raw);
  assert.throws(() => second.save(b), { code: 'SAVE_CONFLICT' });
  const reread = second.load().save;
  assert.equal(reread.coins, 12);
  reread.sound = false;
  assert.equal(second.save(reread).coins, 12);
});

test('same store rejects stale object revisions and invalid candidates without storage writes', () => {
  const storage = new MemoryStorage();
  const store = createStore(storage);
  const stale = store.load().save;
  store.save(stale);
  const raw = storage.data.get(SAVE_KEY);
  assert.throws(() => store.save(stale), { code: 'STALE_SAVE' });
  assert.equal(storage.data.get(SAVE_KEY), raw);
  const current = store.load().save;
  current.coins = -1;
  const count = storage.writes.length;
  assert.throws(() => store.save(current), { code: 'INVALID_SAVE' });
  assert.equal(storage.writes.length, count);
});

for (const phase of ['loading', 'unloading', 'result']) {
  test(`frozen schema 1 ${phase} migrates without writes, continues its original order and saves across reloads`, () => {
    const raw = legacyRaw(phase);
    const original = JSON.parse(raw);
    const unchanged = copy(original);
    assert.equal(validateSave(original), original);
    assert.deepEqual(original, unchanged, 'validation must not migrate or normalize the historical input');
    const storage = new MemoryStorage();
    storage.data.set(SAVE_KEY, raw);
    let store = createStore(storage);
    const loaded = store.load();
    assert.equal(loaded.error, null);
    assert.equal(loaded.raw, raw);
    let save = loaded.save;
    const expected = copy(original);
    expected.schema = 2;
    expected.active.contentVersion = 1;
    assert.deepEqual(save, expected, 'only schema/content metadata changes on migration');
    assert.equal(store.exportRaw(), raw);
    assert.equal(storage.data.get(SAVE_KEY), raw);
    assert.deepEqual(storage.writes, []);
    const order = getOrder(save.active.orderId, save.active.contentVersion);
    assert.ok(order);
    let firstWrite = true;
    const persistAndReload = () => {
      save = store.save(save);
      if (firstWrite) {
        assert.equal(storage.data.get(BACKUP_KEY), raw, 'first normal save backs up the exact historical bytes');
        firstWrite = false;
      }
      assert.equal(JSON.parse(storage.data.get(SAVE_KEY)).schema, 2);
      store = createStore(storage);
      const resumed = store.load();
      assert.equal(resumed.error, null);
      save = resumed.save;
      assert.equal(save.active.contentVersion, 1);
    };
    if (phase === 'loading') {
      assert.ok(inspect(order, save.active.placements).issues.some(issue => issue.code === 'heavyFront'),
        'historically valid loading may still need arranging before departure');
      for (const cargo of order.cargo) {
        const p = order.solution[cargo.id];
        assert.equal(canPlace(order, save.active.placements, cargo.id, p.x, p.y, p.r).ok, true);
        save.active.placements[cargo.id] = { ...p };
        save.active.moves++;
        persistAndReload();
      }
      assert.equal(inspect(order, save.active.placements).ready, true);
      save.active.phase = 'unloading';
      persistAndReload();
    }
    if (save.active.phase === 'unloading') {
      while (save.active.delivered.length < order.cargo.length) {
        const atStop = order.cargo.filter(cargo => cargo.stop === save.active.stop && save.active.placements[cargo.id]);
        if (atStop.length === 0) {
          assert.ok(save.active.stop < order.stops.length - 1);
          save.active.stop++;
        } else {
          const cargo = atStop.find(item => unloadPath(order, save.active.placements, item.id));
          assert.ok(cargo, 'original route must remain physically unloadable');
          delete save.active.placements[cargo.id];
          save.active.delivered.push(cargo.id);
        }
        persistAndReload();
      }
    }
    settleOrder(save, 3);
    const expectedCoins = original.coins + (phase === 'result' ? 0 : order.reward + 30);
    assert.equal(save.coins, expectedCoins, 'legacy reward comes from the original order');
    save.sound = !save.sound;
    persistAndReload();
    const settled = copy(save);
    settleOrder(save, 3);
    assert.deepEqual(save, settled, 'reloaded result cannot settle twice');
    const paidReward = save.completed[order.id].reward;
    save.active = active(order, {
      contentVersion: 1, phase: 'unloading', stop: order.stops.length - 1,
      delivered: order.cargo.map(cargo => cargo.id),
    });
    settleOrder(save, 3);
    assert.equal(save.coins, expectedCoins, 'replaying a migrated order cannot farm coins');
    assert.equal(save.completed[order.id].reward, paidReward);
    persistAndReload();
    save.active = active(ORDERS[0]);
    save = store.save(save);
    store = createStore(storage);
    save = store.load().save;
    assert.equal(save.active.contentVersion, 2, 'the next newly started order uses the current contract');
    const cargo = ORDERS[0].cargo[0];
    save.active.placements[cargo.id] = copy(ORDERS[0].solution[cargo.id]);
    save.active.moves++;
    save = store.save(save);
    assert.equal(loadSave(storage).save.active.moves, 1);
    assert.equal(save.coins, expectedCoins);
    assert.deepEqual(new Set(storage.writes), new Set([SAVE_KEY, BACKUP_KEY]));
  });
}

test('schema 2 permits omitted floor z but rejects malformed layers and unknown content versions', () => {
  const base = freshSave();
  const order = ORDERS[0];
  const cargo = order.cargo[0];
  const p = copy(order.solution[cargo.id]);
  delete p.z;
  base.active = active(order, { placements: { [cargo.id]: p } });
  validateSave(base);
  base.active.placements[cargo.id].z = 0;
  validateSave(base);
  for (const z of [-1, 2, 0.5, '1', null, undefined, NaN, Infinity]) {
    const save = copy(base);
    save.active.placements[cargo.id].z = z;
    assert.throws(() => validateSave(save), { code: 'INVALID_SAVE' }, `reject z=${String(z)}`);
  }
  for (const version of [0, 3, '2', null, undefined]) {
    const save = copy(base);
    save.active.contentVersion = version;
    assert.throws(() => validateSave(save), { code: 'INVALID_SAVE' });
  }
  const missing = copy(base);
  delete missing.active.contentVersion;
  assert.throws(() => validateSave(missing), { code: 'INVALID_SAVE' });
  for (const schema of [1, 2]) {
    const save = JSON.parse(legacyRaw('loading'));
    save.schema = schema;
    if (schema === 2) save.active.contentVersion = 1;
    save.active.placements['o06-1'].z = 0;
    validateSave(save);
    save.active.placements['o06-1'].z = 1;
    assert.throws(() => validateSave(save), { code: 'INVALID_SAVE' }, 'legacy content cannot acquire a stacked layer');
  }
});

test('schema 2 rejects a saved top cargo after its floor support disappears', () => {
  const order = ORDERS.find(item => Object.values(item.solution).some(p => p.z === 1));
  assert.ok(order, 'current authored content exercises supported stacking');
  const save = freshSave();
  if (!save.ownedTrucks.includes(order.truckId)) save.ownedTrucks.push(order.truckId);
  save.active = active(order, { placements: copy(order.solution) });
  validateSave(save);
  const top = order.cargo.find(cargo => save.active.placements[cargo.id].z === 1);
  const topPlacement = save.active.placements[top.id];
  const topCells = new Set(cellsFor(top.type, topPlacement.r).map(([x, y]) => `${x + topPlacement.x},${y + topPlacement.y}`));
  const support = order.cargo.find(cargo => {
    const p = save.active.placements[cargo.id];
    return (p.z ?? 0) === 0 && cellsFor(cargo.type, p.r).some(([x, y]) => topCells.has(`${x + p.x},${y + p.y}`));
  });
  assert.ok(support);
  delete save.active.placements[support.id];
  assert.throws(() => validateSave(save), { code: 'INVALID_SAVE' });
});

test('invalid historical layouts and unsupported schema 2 content remain untouched during load', () => {
  const badLegacy = JSON.parse(legacyRaw('loading'));
  badLegacy.active.placements['o06-1'].x = 99;
  const badContent = freshSave();
  badContent.active = active(undefined, { contentVersion: 99 });
  const badLayer = freshSave();
  badLayer.active = active(undefined, { placements: { [ORDERS[0].cargo[0].id]: { ...ORDERS[0].solution[ORDERS[0].cargo[0].id], z: 2 } } });
  for (const candidate of [badLegacy, badContent, badLayer]) {
    const storage = new MemoryStorage();
    const raw = JSON.stringify(candidate);
    storage.data.set(SAVE_KEY, raw);
    storage.data.set(BACKUP_KEY, 'previous backup');
    const store = createStore(storage);
    assert.equal(store.load().save, null);
    assert.throws(() => store.save(freshSave()), { code: 'INVALID_SAVE' });
    assert.equal(store.exportRaw(), raw);
    assert.equal(storage.data.get(SAVE_KEY), raw);
    assert.equal(storage.data.get(BACKUP_KEY), 'previous backup');
    assert.deepEqual(storage.writes, []);
  }
});

test('migration backup failure leaves schema 1 primary recoverable until explicit reload and retry', () => {
  const raw = legacyRaw('loading');
  const storage = new MemoryStorage();
  storage.data.set(SAVE_KEY, raw);
  storage.data.set(BACKUP_KEY, 'previous backup');
  const store = createStore(storage);
  const save = store.load().save;
  storage.failure = BACKUP_KEY;
  assert.throws(() => store.save(save), /storage full/);
  assert.equal(storage.data.get(SAVE_KEY), raw);
  assert.equal(storage.data.get(BACKUP_KEY), 'previous backup');
  assert.equal(store.exportRaw(), raw);
  storage.failure = null;
  assert.throws(() => store.save(save), /storage full/);
  const resumed = store.load().save;
  resumed.sound = !resumed.sound;
  store.save(resumed);
  assert.equal(storage.data.get(BACKUP_KEY), raw);
  assert.equal(loadSave(storage).save.schema, 2);
});

test('historical malformed-save checks still reject before migration', () => {
  const mutations = [
    save => { save.revision = Number.MAX_SAFE_INTEGER + 1; },
    save => { save.coins = -1; },
    save => { save.ownedTrucks.push('future-truck'); },
    save => { save.ownedTrucks.push('van'); },
    save => { save.completed.unknown = { stars: 1, reward: 1 }; },
    save => { save.completed.c01 = { stars: 1, reward: 1 }; },
    save => { save.completed.o01.stars = 4; },
    save => { save.active.orderId = 'future-order'; },
    save => { save.active.orderId = 'c01'; },
    save => { save.active.phase = 'driving'; },
    save => { save.active.paid = true; },
    save => { save.active.hints = -1; },
    save => { save.active.stop = 100; },
    save => { save.active.delivered = ['unknown']; },
    save => { save.active.placements.unknown = { x: 0, y: 0, r: 0 }; },
    save => { save.active.placements['o06-1'].x = 99; },
    save => { save.active.placements['o06-1'].x = 0.5; },
    save => { save.active.placements['o06-1'].r = 4; },
    save => { save.active.placements['o06-2'] = { x: 0, y: 3, r: 0 }; },
    save => { save.active.contentVersion = 2; },
    save => { save.active.placements['o06-1'].z = 1; },
  ];
  for (const mutation of mutations) {
    const save = JSON.parse(legacyRaw('loading'));
    mutation(save);
    assert.throws(() => validateSave(save), { code: 'INVALID_SAVE' });
    const storage = new MemoryStorage();
    const raw = JSON.stringify(save);
    storage.data.set(SAVE_KEY, raw);
    assert.equal(loadSave(storage).save, null);
    assert.equal(storage.data.get(SAVE_KEY), raw);
    assert.deepEqual(storage.writes, []);
  }
});

test('concurrent migration preserves the first writer and exact historical backup', () => {
  const storage = new MemoryStorage();
  const raw = legacyRaw('unloading');
  storage.data.set(SAVE_KEY, raw);
  const first = createStore(storage), second = createStore(storage);
  const a = first.load().save, b = second.load().save;
  a.sound = false;
  first.save(a);
  const migrated = storage.data.get(SAVE_KEY);
  b.sound = true;
  assert.throws(() => second.save(b), { code: 'SAVE_CONFLICT' });
  assert.equal(storage.data.get(SAVE_KEY), migrated);
  assert.equal(storage.data.get(BACKUP_KEY), raw);
  assert.equal(second.exportRaw(), migrated);
  const resumed = second.load().save;
  resumed.sound = true;
  second.save(resumed);
  assert.equal(loadSave(storage).save.sound, true);
});
