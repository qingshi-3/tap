import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTENT, upgradeCost, createGame, dispatch, tick, validate } from '../js/engine.js';
import { SAVE_KEY, BACKUP_KEY, loadGame, saveGame, exportRaw } from '../js/storage.js';

class MemoryStorage {
  data = new Map();
  failKey = null;
  failRead = false;
  throwAfterWrite = false;
  getItem(key) { if (this.failRead) throw Error('denied'); return this.data.get(key) ?? null; }
  setItem(key, value) {
    if (key === this.failKey) throw Error('full');
    this.data.set(key, String(value));
    if (this.throwAfterWrite && key === SAVE_KEY) throw Error('host response failed');
  }
}

function work(state, { prepare = true, sort = true, increment = 0.2 } = {}) {
  let guard = 0;
  while (state.phase === 'running' && guard++ < 2000) {
    for (const parcel of [...state.shift.parcels]) {
      if (prepare && !state.shift.processing && ['fragile', 'large', 'exception'].includes(parcel.kind) && !parcel.prepared) assert.equal(dispatch(state, { type: 'PREPARE', id: parcel.id }).ok, true);
      if (sort && (!['fragile', 'large', 'exception'].includes(parcel.kind) || parcel.prepared) && (sort !== 'special' || parcel.kind !== 'normal')) assert.equal(dispatch(state, { type: 'SORT', id: parcel.id, dest: parcel.dest }).ok, true);
    }
    tick(state, increment);
    assert.equal(validate(state).ok, true, validate(state).message);
  }
  assert.notEqual(state.phase, 'running', 'every day must finish');
}

test('complete 18 days, settle once, continue and save through freeplay', () => {
  const storage = new MemoryStorage();
  let state = loadGame(storage).state;
  assert.equal(saveGame(storage, state).ok, true);
  for (let day = 1; day <= 19; day++) {
    assert.equal(state.day, day);
    for (const upgrade of CONTENT.upgrades) {
      while (state.cash >= upgradeCost(state, upgrade.id) && state.day >= upgrade.unlockDay && (state.upgrades[upgrade.id] || 0) < upgrade.max) assert.equal(dispatch(state, { type: 'BUY', id: upgrade.id }).ok, true);
    }
    assert.equal(dispatch(state, { type: 'START', plan: day % 2 ? 'steady' : 'rush', route: day % 3 }).ok, true);
    work(state);
    assert.equal(state.dayResult.success, true);
    assert.equal(state.dayResult.delivered, state.shift.total);
    assert.equal(state.phase, day === 18 ? 'ending' : 'summary');
    const cash = state.cash;
    const count = state.history.length;
    tick(state, 999);
    assert.equal(dispatch(state, { type: 'START' }).ok, false);
    assert.equal(state.cash, cash);
    assert.equal(state.history.length, count);
    assert.equal(saveGame(storage, state).ok, true);
    state = loadGame(storage).state;
    assert.equal(state.cash, cash);
    assert.equal(dispatch(state, { type: 'NEXT' }).ok, true);
    assert.equal(dispatch(state, { type: 'NEXT' }).ok, false);
    assert.equal(saveGame(storage, state).ok, true);
    state = loadGame(storage).state;
  }
  assert.equal(state.day, 20);
  assert.equal(state.history.length, 19);
  assert.equal(new Set(state.history.map(item => item.station)).size, 3);
});

test('wrong lane retains parcel and actionable preparation/insufficiency recovers', () => {
  const state = createGame();
  const blocked = dispatch(state, { type: 'BUY', id: 'sorter' });
  assert.match(blocked.message, /14/);
  dispatch(state, { type: 'START' });
  const parcel = state.shift.parcels[0];
  assert.equal(dispatch(state, { type: 'SORT', id: parcel.id, dest: (parcel.dest + 1) % 3 }).ok, false);
  assert.equal(state.shift.parcels[0], parcel);
  assert.equal(state.shift.errors, 1);
  assert.equal(dispatch(state, { type: 'BUY', id: 'worker' }).ok, false);
  work(state);
  dispatch(state, { type: 'NEXT' });
  state.cash = 0;
  assert.match(dispatch(state, { type: 'BUY', id: 'worker' }).message, /还差 140/);
  dispatch(state, { type: 'START' });
  work(state);
  assert.ok(state.cash > 0);
  dispatch(state, { type: 'NEXT' });
  dispatch(state, { type: 'START' });
  const fragile = state.shift.parcels[0];
  assert.equal(fragile.kind, 'fragile');
  assert.match(dispatch(state, { type: 'SORT', id: fragile.id, dest: fragile.dest }).message, /包装/);
  assert.equal(state.shift.parcels.includes(fragile), true);
  assert.equal(dispatch(state, { type: 'PREPARE', id: fragile.id }).ok, true);
  assert.equal(dispatch(state, { type: 'PREPARE', id: fragile.id }).ok, false);
  tick(state, 3);
  assert.equal(dispatch(state, { type: 'SORT', id: fragile.id, dest: fragile.dest }).ok, true);
});

test('all five parcel roles, manual-only campaign and exact accounting', () => {
  const state = createGame();
  const seen = new Set();
  for (let day = 1; day <= 18; day++) {
    dispatch(state, { type: 'START', plan: 'steady' });
    while (state.phase === 'running') {
      for (const parcel of [...state.shift.parcels]) {
        seen.add(parcel.kind);
        if (['fragile', 'large', 'exception'].includes(parcel.kind) && !parcel.prepared) {
          if (!state.shift.processing) assert.equal(dispatch(state, { type: 'PREPARE', id: parcel.id }).ok, true);
        } else assert.equal(dispatch(state, { type: 'SORT', id: parcel.id, dest: parcel.dest }).ok, true);
      }
      tick(state, 0.5);
    }
    assert.equal(state.dayResult.success, true);
    assert.equal(state.shift.delivered, state.shift.total);
    assert.equal(validate(state).ok, true, validate(state).message);
    if (day < 18) dispatch(state, { type: 'NEXT' });
  }
  assert.deepEqual([...seen].sort(), CONTENT.types.map(type => type.id).sort());
});

test('idling cannot deadlock and unsuccessful contracts still permit continuation', () => {
  const state = createGame();
  dispatch(state, { type: 'START', plan: 'rush' });
  tick(state, 1000);
  assert.equal(state.phase, 'summary');
  assert.equal(state.shift.timedOut, true);
  assert.equal(state.shift.missed, state.shift.total);
  assert.equal(state.dayResult.success, false);
  assert.equal(state.cash, 100);
  assert.equal(validate(state).ok, true);
  assert.equal(dispatch(state, { type: 'NEXT' }).ok, true);
});

test('choices alter workload and route pay; spawns are reproducible', () => {
  const ordinary = createGame();
  const focused = createGame();
  const rush = createGame();
  dispatch(ordinary, { type: 'START' });
  dispatch(focused, { type: 'START', route: 0 });
  dispatch(rush, { type: 'START', plan: 'rush' });
  assert.ok(rush.shift.total > ordinary.shift.total);
  assert.ok(rush.contract.bonus > ordinary.contract.bonus);
  const twin = structuredClone(rush);
  tick(rush, 12);
  tick(twin, 12);
  assert.deepEqual(rush, twin);
  work(ordinary);
  work(focused);
  assert.ok(focused.dayResult.earnings > ordinary.dayResult.earnings);
});

test('workers transfer, trucks own settlement and urgent handling has priority', () => {
  const state = createGame();
  dispatch(state, { type: 'START' });
  const first = state.shift.parcels[0];
  dispatch(state, { type: 'SORT', id: first.id, dest: first.dest });
  assert.equal(state.shift.delivered, 0);
  tick(state, 0.1);
  assert.equal(state.shift.workers[0].parcel.id, first.id);
  tick(state, 2.5);
  assert.equal(state.shift.loading[first.dest].length, 1);
  assert.equal(state.shift.delivered, 0);
  tick(state, 10);
  assert.equal(state.shift.delivered, 1);
  assert.ok(state.shift.earnings > 0);
  const normal = state.shift.parcels[0];
  const urgent = state.shift.parcels[1];
  urgent.kind = 'urgent';
  dispatch(state, { type: 'SORT', id: normal.id, dest: normal.dest });
  dispatch(state, { type: 'SORT', id: urgent.id, dest: urgent.dest });
  tick(state, 0.1);
  assert.equal(state.shift.workers[0].parcel.id, urgent.id);
});

test('save reload continues mid-shift and preserves exact previous save as backup', () => {
  const storage = new MemoryStorage();
  let state = loadGame(storage).state;
  saveGame(storage, state);
  const original = storage.getItem(SAVE_KEY);
  dispatch(state, { type: 'START', route: 2 });
  tick(state, 8);
  assert.equal(saveGame(storage, state).ok, true);
  assert.equal(storage.getItem(BACKUP_KEY), original);
  state = loadGame(storage).state;
  const elapsed = state.shift.elapsed;
  tick(state, 1);
  assert.ok(state.shift.elapsed > elapsed);
  assert.equal(saveGame(storage, state).ok, true);
  state = loadGame(storage).state;
  work(state);
  assert.equal(saveGame(storage, state).ok, true);
  state = loadGame(storage).state;
  const cash = state.cash;
  tick(state, 500);
  assert.equal(state.cash, cash);
  dispatch(state, { type: 'NEXT' });
  assert.equal(saveGame(storage, state).ok, true);
});

test('malformed/future data retains original; unknown nested fields rejected', () => {
  const storage = new MemoryStorage();
  for (const raw of ['{bad', JSON.stringify({ ...createGame(), schema: 2 }), JSON.stringify({ ...createGame(), upgrades: { futureMachine: 1 } }), JSON.stringify({ ...createGame(), history: [{ day: 9 }] }), 'null', '[]']) {
    storage.setItem(SAVE_KEY, raw);
    assert.equal(loadGame(storage).ok, false);
    assert.equal(saveGame(storage, createGame()).ok, false);
    assert.equal(storage.getItem(SAVE_KEY), raw);
    assert.equal(exportRaw(storage).raw, raw);
  }
  const state = createGame();
  dispatch(state, { type: 'START' });
  state.shift.parcels[0].futureInstruction = true;
  assert.equal(validate(state).ok, false);
});

test('stale page cannot overwrite another page, even at same revision', () => {
  const storage = new MemoryStorage();
  const pageA = loadGame(storage).state;
  const pageB = loadGame(storage).state;
  dispatch(pageA, { type: 'START' });
  assert.equal(saveGame(storage, pageA).ok, true);
  dispatch(pageB, { type: 'START' });
  assert.equal(saveGame(storage, pageB).code, 'stale');
  const pageC = loadGame(storage).state;
  const pageD = loadGame(storage).state;
  tick(pageC, 0.5);
  tick(pageD, 1);
  assert.equal(pageC.revision, pageD.revision);
  assert.equal(saveGame(storage, pageC).ok, true);
  const committed = storage.getItem(SAVE_KEY);
  assert.equal(saveGame(storage, pageD).code, 'stale');
  assert.equal(storage.getItem(SAVE_KEY), committed);
});

test('read, backup and primary write failures preserve progress and allow retry', () => {
  const storage = new MemoryStorage();
  const state = loadGame(storage).state;
  saveGame(storage, state);
  const old = storage.getItem(SAVE_KEY);
  dispatch(state, { type: 'START' });
  storage.failKey = BACKUP_KEY;
  assert.equal(saveGame(storage, state).code, 'backup_failed');
  assert.equal(storage.getItem(SAVE_KEY), old);
  storage.failKey = SAVE_KEY;
  assert.equal(saveGame(storage, state).code, 'write_failed');
  assert.equal(storage.getItem(SAVE_KEY), old);
  storage.failRead = true;
  assert.equal(loadGame(storage).code, 'storage_unavailable');
  assert.equal(saveGame(storage, state).code, 'storage_unavailable');
  storage.failRead = false;
  storage.failKey = null;
  assert.equal(saveGame(storage, state).ok, true);
  tick(state, 1);
  storage.throwAfterWrite = true;
  assert.equal(saveGame(storage, state).recovered, true);
  storage.throwAfterWrite = false;
  const reloaded = loadGame(storage).state;
  tick(reloaded, 1);
  assert.equal(saveGame(storage, reloaded).ok, true);
});

test('commit plus unavailable read-back recovers without treating own write as stale', () => {
  const storage = new MemoryStorage();
  const state = loadGame(storage).state;
  saveGame(storage, state);
  dispatch(state, { type: 'START' });
  const write = storage.setItem.bind(storage);
  storage.setItem = (key, value) => {
    write(key, value);
    if (key === SAVE_KEY) { storage.failRead = true; throw Error('connection lost after commit'); }
  };
  assert.equal(saveGame(storage, state).code, 'write_failed');
  storage.failRead = false;
  storage.setItem = write;
  tick(state, 2);
  assert.equal(saveGame(storage, state).ok, true);
  assert.equal(loadGame(storage).state.shift.elapsed, state.shift.elapsed);
});

test('daily schedules change handling/departures; automation keeps special sorting manual', () => {
  const state = createGame();
  while (state.day < 14) {
    dispatch(state, { type: 'START' });
    assert.equal(state.shift.departures[0], CONTENT.days[state.day - 1].departureEvery);
    work(state, { increment: 0.5 });
    dispatch(state, { type: 'NEXT' });
  }
  assert.ok(new Set(CONTENT.days.map(day => day.departureEvery)).size > 3);
  assert.ok(new Set(CONTENT.days.map(day => day.workerSeconds)).size > 3);
  assert.ok(CONTENT.days[13].weights.filter(kind => kind === 'exception').length > CONTENT.days[12].weights.filter(kind => kind === 'exception').length);
  state.cash = 5000;
  for (const upgrade of CONTENT.upgrades) {
    while ((state.upgrades[upgrade.id] || 0) < upgrade.max) assert.equal(dispatch(state, { type: 'BUY', id: upgrade.id }).ok, true);
  }
  dispatch(state, { type: 'START' });
  assert.equal(state.shift.workers.length, 3);
  assert.equal(state.shift.departures[0], 7);
  const special = state.shift.parcels[0];
  assert.equal(special.kind, 'exception');
  assert.equal(special.prepared, true);
  tick(state, 12);
  assert.equal(state.shift.parcels.includes(special), true, 'special parcel must still await a manual destination');
  work(state, { prepare: false, sort: 'special', increment: 0.5 });
  assert.equal(state.dayResult.success, true);
  assert.equal(state.shift.delivered, state.shift.total);
  assert.ok(state.shift.specialHandled > 0);
});

test('belt backpressure spaces parcels, pauses inbound and resumes when cleared', () => {
  const state = createGame();
  dispatch(state, { type: 'START' });
  tick(state, 60);
  assert.equal(state.shift.parcels.length, 5);
  assert.equal(state.shift.spawned, 5);
  assert.ok(state.shift.spawned < state.shift.total);
  const byPosition = [...state.shift.parcels].sort((a, b) => b.x - a.x);
  for (let i = 1; i < byPosition.length; i++) assert.ok(byPosition[i - 1].x - byPosition[i].x >= 0.2 - 1e-8);
  const first = byPosition[0];
  dispatch(state, { type: 'SORT', id: first.id, dest: first.dest });
  tick(state, 4);
  assert.ok(state.shift.spawned > 5, 'clearing a lane resumes inbound');
  work(state);
  assert.equal(state.dayResult.delivered, state.shift.total);
  assert.equal(state.dayResult.missed, 0);
});

test('late urgent deliveries lose on-time contract credit without vanishing', () => {
  const state = createGame();
  dispatch(state, { type: 'START' });
  state.shift.parcels[0].kind = 'urgent';
  tick(state, 5);
  state.shift.parcels[1].kind = 'urgent';
  tick(state, 30);
  work(state);
  assert.equal(state.shift.delivered, state.shift.total);
  assert.equal(state.shift.missed, 2);
  assert.equal(state.shift.urgentDelivered, 0);
  assert.equal(state.dayResult.success, false);
  assert.equal(state.dayResult.bonus, 0);
  assert.equal(validate(state).ok, true);
});


test('shared workbench persists one asynchronous job while normal sorting continues', () => {
  const storage = new MemoryStorage();
  let state = loadGame(storage).state;
  dispatch(state, { type: 'START' });
  const special = state.shift.parcels[0];
  special.kind = 'fragile';
  assert.equal(dispatch(state, { type: 'PREPARE', id: special.id }).ok, true);
  assert.deepEqual(state.shift.processing, { id: special.id, remaining: 3, duration: 3 });
  assert.equal(special.prepared, false);
  assert.equal(dispatch(state, { type: 'SORT', id: special.id, dest: special.dest }).ok, false);
  assert.equal(dispatch(state, { type: 'PREPARE', id: special.id }).ok, false);
  tick(state, 2.5);
  const normal = state.shift.parcels.find(parcel => parcel.kind === 'normal');
  assert.ok(normal);
  normal.kind = 'large';
  assert.equal(dispatch(state, { type: 'PREPARE', id: normal.id }).ok, false);
  normal.kind = 'normal';
  assert.equal(dispatch(state, { type: 'SORT', id: normal.id, dest: normal.dest }).ok, true);
  assert.equal(saveGame(storage, state).ok, true);
  state = loadGame(storage).state;
  assert.ok(state.shift.processing.remaining > 0);
  for (const job of [{id: 999, remaining: 1, duration: 3}, {id: special.id, remaining: 0, duration: 3}, {id: special.id, remaining: 4, duration: 3}, {id: special.id, remaining: 1, duration: 4}, {id: special.id, remaining: 1, duration: 3, extra: 1}]) {
    const bad = structuredClone(state); bad.shift.processing = job;
    assert.equal(validate(bad).ok, false);
  }
  const events = tick(state, 0.5);
  assert.equal(state.shift.processing, null);
  assert.equal(events.filter(event => event.type === 'prepared').length, 1);
  assert.equal(dispatch(state, { type: 'PREPARE', id: special.id }).ok, false);
  assert.equal(dispatch(state, { type: 'SORT', id: special.id, dest: special.dest }).ok, true);
  assert.equal(tick(state, 0.2).some(event => event.type === 'prepared'), false);
  assert.equal(saveGame(storage, state).ok, true);
  state = loadGame(storage).state;
  work(state);
  assert.equal(state.shift.processing, null);
});

test('manual dispatch pays batch bonus exactly once and resets only its lane clock', () => {
  const state = createGame();
  dispatch(state, { type: 'START' });
  assert.equal(dispatch(state, { type: 'DISPATCH', dest: 0 }).ok, false);
  tick(state, 5);
  const batch = state.shift.parcels.splice(0, 3);
  assert.equal(batch.length, 3);
  for (const parcel of batch) { parcel.dest = 0; state.shift.loading[0].push(parcel); }
  const otherClock = state.shift.departures[1];
  const departed = dispatch(state, { type: 'DISPATCH', dest: 0 });
  assert.equal(departed.ok, true);
  assert.equal(departed.events[0].batchBonus, 3);
  assert.equal(departed.events[0].earnings, 18);
  assert.equal(state.shift.earnings, 18);
  assert.equal(state.shift.departures[0], CONTENT.days[0].departureEvery);
  assert.equal(state.shift.departures[1], otherClock);
  assert.equal(dispatch(state, { type: 'DISPATCH', dest: 0 }).ok, false);
  assert.equal(state.shift.earnings, 18);
  assert.equal(validate(state).ok, true);
  work(state);
  const cash = state.cash;
  tick(state, 1000);
  assert.equal(dispatch(state, { type: 'DISPATCH', dest: 0 }).ok, false);
  assert.equal(state.cash, cash);
});

test('early investment is a choice and worker levels have distinct costs', () => {
  const state = createGame(); dispatch(state, { type: 'START', route: 0 }); work(state);
  dispatch(state, { type: 'NEXT' });
  assert.equal(state.day, 2);
  assert.equal(upgradeCost(state, 'worker'), 140);
  assert.equal(upgradeCost(state, 'packer'), 170);
  const alternative = structuredClone(state);
  assert.equal(dispatch(state, { type: 'BUY', id: 'worker' }).ok, true);
  assert.equal(upgradeCost(state, 'worker'), 260);
  assert.equal(dispatch(state, { type: 'BUY', id: 'packer' }).ok, false);
  assert.equal(dispatch(alternative, { type: 'BUY', id: 'packer' }).ok, true);
  assert.equal(dispatch(alternative, { type: 'BUY', id: 'worker' }).ok, false);
});


test('legacy running schema1 without workbench keeps saving and each special has its own duration', () => {
  for (const [kind, duration] of [['fragile', 3], ['large', 5], ['exception', 4]]) {
    const storage = new MemoryStorage();
    let state = createGame(); dispatch(state, { type: 'START' });
    delete state.shift.processing;
    state.shift.parcels[0].kind = kind;
    storage.setItem(SAVE_KEY, JSON.stringify(state));
    const loaded = loadGame(storage); assert.equal(loaded.ok, true); state = loaded.state;
    assert.equal(dispatch(state, { type: 'PREPARE', id: 1 }).ok, true);
    assert.equal(state.shift.processing.duration, duration);
    const wrongKind = structuredClone(state); wrongKind.shift.parcels[0].kind = 'normal';
    assert.equal(validate(wrongKind).ok, false);
    const prepared = structuredClone(state); prepared.shift.parcels[0].prepared = true;
    assert.equal(validate(prepared).ok, false);
    tick(state, duration - 0.2);
    assert.equal(state.shift.parcels[0].prepared, false);
    assert.equal(saveGame(storage, state).ok, true);
    state = loadGame(storage).state;
    tick(state, 0.2);
    assert.equal(state.shift.parcels[0].prepared, true);
    assert.equal(state.shift.processing, null);
    assert.equal(saveGame(storage, state).ok, true);
  }
});

test('new arrival cadence speeds rush while an empty belt replenishes immediately', () => {
  for (const [plan, interval] of [['steady', 2.4], ['rush', 1.8]]) {
    const state = createGame(); dispatch(state, { type: 'START', plan });
    tick(state, interval - 0.1);
    assert.equal(state.shift.spawned, 1);
    tick(state, 0.1);
    assert.equal(state.shift.spawned, 2);
    for (const parcel of [...state.shift.parcels]) dispatch(state, { type: 'SORT', id: parcel.id, dest: parcel.dest });
    tick(state, 0.1);
    assert.equal(state.shift.spawned, 3);
    assert.equal(validate(state).ok, true);
  }
});
