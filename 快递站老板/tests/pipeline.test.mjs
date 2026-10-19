import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONTENT, createGame, dispatch, tick, validate, managementView, orderPreview, PIPELINE_LAYOUT, pipelineWorkerPoint } from '../js/engine.js';
import { SAVE_KEY, loadGame, saveGame } from '../js/storage.js';

const copy = state => JSON.parse(JSON.stringify(state));
const storageFor = state => {
  const data = new Map(state ? [[SAVE_KEY, JSON.stringify(state)]] : []);
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};
const act = (state, action) => { const outcome = dispatch(state, action); assert.equal(outcome.ok, true, outcome.message); return outcome; };
function advance(state, seconds) { tick(state, seconds); assert.equal(validate(state).ok, true, validate(state).message); }
function legacyDay(state) {
  act(state, { type: 'START' });
  while (state.phase === 'running') {
    for (const parcel of [...state.shift.parcels]) {
      if (['fragile', 'large', 'exception'].includes(parcel.kind) && !parcel.prepared) {
        if (!state.shift.processing) act(state, { type: 'PREPARE', id: parcel.id });
      } else act(state, { type: 'SORT', id: parcel.id, dest: parcel.dest });
    }
    tick(state, 0.2);
  }
  act(state, { type: 'NEXT' });
}
function atDay(day) { const state = createGame(); while (state.day < day) legacyDay(state); return state; }
function automated({ day = 1, upgrades = [], staff, plan = 'steady' } = {}) {
  const state = atDay(day);
  for (const id of upgrades) act(state, { type: 'BUY', id });
  act(state, { type: 'ENABLE_MANAGEMENT' });
  if (staff) act(state, { type: 'SET_STAFF', staff });
  act(state, { type: 'START', plan });
  return state;
}

test('accepted order waits through staffing and reload until opening, then consumes its draft', () => {
  let state = createGame();
  act(state, { type: 'ENABLE_MANAGEMENT' });
  const before = copy(state);
  act(state, { type: 'SET_ORDER', plan: 'rush', route: 2 });
  assert.deepEqual(state, { ...before, revision: before.revision + 1, plannedOrder: { plan: 'rush', route: 2 } });
  const waiting = copy(state);
  assert.deepEqual(tick(state, 999), []);
  assert.deepEqual(state, waiting, 'accepted orders do not spawn freight, advance time or earn money');
  act(state, { type: 'SET_STAFF', staff: { sort: 2, pack: 1, load: 0 } });
  const storage = storageFor();
  assert.equal(saveGame(storage, state).ok, true);
  state = loadGame(storage).state;
  assert.equal(state.phase, 'planning');
  assert.equal(state.shift, null);
  assert.equal(state.contract, null);
  assert.deepEqual(state.plannedOrder, { plan: 'rush', route: 2 });
  const roster = copy(managementView(state).workers);
  const preview = orderPreview(state, state.plannedOrder);
  act(state, { type: 'START' });
  assert.equal(state.phase, 'running');
  assert.equal(Object.hasOwn(state, 'plannedOrder'), false);
  assert.equal(state.contract.plan, 'rush');
  assert.equal(state.contract.route, 2);
  assert.equal(state.shift.total, preview.total);
  assert.equal(state.shift.elapsed, 0);
  assert.equal(state.shift.spawned, 1);
  assert.equal(state.shift.parcels[0].dest, 2);
  assert.deepEqual(state.shift.flow.workers.map(({ x, y, ...worker }) => worker), roster.map(({ x, y, ...worker }) => worker), 'opening uses the most recent saved staffing; planning uses wider touch spacing');
  const opened = copy(state);
  assert.equal(dispatch(state, { type: 'START' }).ok, false);
  assert.equal(dispatch(state, { type: 'SET_ORDER', plan: 'steady', route: null }).ok, false);
  assert.deepEqual(state, opened);
  advance(state, 999);
  act(state, { type: 'NEXT' });
  assert.equal(Object.hasOwn(state, 'plannedOrder'), false);
  act(state, { type: 'START' });
  assert.equal(state.contract.plan, 'steady');
  assert.equal(state.contract.route, null);
});

test('invalid order drafts reject actions and persisted documents without modifying originals', () => {
  const state = createGame();
  const drafts = [null, {}, { plan: 'rush' }, { plan: 'steady', route: undefined },
    { plan: 'express', route: null }, { plan: null, route: 0 },
    { plan: 'rush', route: -1 }, { plan: 'rush', route: 3 }, { plan: 'rush', route: '1' },
    { plan: 'steady', route: null, extra: true }];
  for (const draft of drafts) {
    const bad = { ...copy(state), plannedOrder: draft };
    assert.equal(validate(bad).ok, false);
    const storage = storageFor(bad), raw = storage.getItem(SAVE_KEY);
    assert.equal(loadGame(storage).ok, false);
    assert.equal(storage.getItem(SAVE_KEY), raw);
    if (draft && !Object.hasOwn(draft, 'extra')) {
      const untouched = copy(state);
      assert.equal(dispatch(state, { type: 'SET_ORDER', ...draft }).ok, false);
      assert.deepEqual(state, untouched);
    }
  }
  act(state, { type: 'SET_ORDER', plan: 'rush', route: 1 });
  act(state, { type: 'START', plan: 'steady', route: null });
  assert.equal(state.contract.plan, 'steady');
  assert.equal(state.contract.route, null, 'explicit opening choices override the draft');
  const bad = { ...copy(state), plannedOrder: { plan: 'steady', route: null } };
  assert.equal(validate(bad).ok, false, 'a running save cannot retain a preparation draft');
});

test('three baseline staff autonomously receive, sort, pack every parcel, load and settle once', () => {
  const state = automated();
  const completed = { sort: 0, pack: 0, load: 0 };
  while (state.phase === 'running') {
    for (const event of tick(state, 0.1)) if (event.type === 'pipelineDone') completed[event.stage]++;
    const physicalBelt = [...state.shift.parcels, ...state.shift.flow.workers.filter(worker => worker.role === 'sort' && worker.phase === 'pickup').map(worker => worker.parcel)].sort((a, b) => a.id - b.id);
    assert.ok(physicalBelt.length <= 5);
    assert.ok(physicalBelt.every((parcel, index) => !index || physicalBelt[index - 1].x - parcel.x >= 0.2 - 1e-7), 'reserved cartons retain physical belt spacing');
    assert.equal(validate(state).ok, true, validate(state).message);
  }
  assert.deepEqual(completed, { sort: 9, pack: 9, load: 9 });
  assert.equal(state.dayResult.delivered, 9);
  assert.equal(state.dayResult.success, true);
  assert.equal(managementView(state).total, 3);
  assert.equal(validate(state).ok, true);
  const final = copy(state);
  tick(state, 999);
  assert.deepEqual(state, final);
  assert.equal(dispatch(state, { type: 'ENABLE_MANAGEMENT' }).ok, false);
});

test('zero staffing truly stops a stage and restores queued freight after reassignment', () => {
  for (const paused of ['sort', 'pack', 'load']) {
    const staff = { sort: 1, pack: 1, load: 1 };
    staff[paused] = 0;
    staff[paused === 'sort' ? 'pack' : 'sort']++;
    const state = automated({ staff });
    advance(state, 25);
    assert.equal(state.shift.delivered, 0, paused);
    assert.ok(managementView(state).roles[paused].pending > 0, paused);
    act(state, { type: 'SET_STAFF', staff: { sort: 1, pack: 1, load: 1 } });
    advance(state, 65);
    assert.ok(state.shift.delivered > 0, paused);
  }
});

test('busy staff finish and unload their current parcel before walking to the new role', () => {
  const state = automated();
  while (!state.shift.flow.workers.find(worker => worker.role === 'sort' && worker.phase === 'work')) advance(state, 0.1);
  const worker = state.shift.flow.workers.find(worker => worker.role === 'sort');
  const point = { x: worker.x, y: worker.y }, id = worker.parcel.id;
  act(state, { type: 'SET_STAFF', staff: { sort: 0, pack: 2, load: 1 } });
  assert.equal(worker.role, 'sort');
  assert.equal(worker.targetRole, 'pack');
  assert.deepEqual({ x: worker.x, y: worker.y }, point);
  while (worker.parcel) {
    assert.equal(worker.parcel.id, id);
    assert.equal(worker.role, 'sort');
    const old = { x: worker.x, y: worker.y };
    advance(state, 0.1);
    assert.ok(Math.hypot(worker.x - old.x, worker.y - old.y) <= PIPELINE_LAYOUT.speed * 0.1 + 1e-7);
  }
  assert.equal(worker.phase, 'transfer');
  assert.ok([...state.shift.flow.pack, ...state.shift.flow.workers.map(item => item.parcel).filter(Boolean)].some(parcel => parcel.id === id));
  while (worker.phase === 'transfer') advance(state, 0.1);
  assert.equal(worker.role, 'pack');
  act(state, { type: 'SET_STAFF', staff: { sort: 1, pack: 1, load: 1 } });
  advance(state, 90);
  assert.equal(state.dayResult.delivered + state.dayResult.missed, 9);
});

test('five employees at the same idle workstation occupy distinct persistent positions', () => {
  const state = atDay(8);
  for (let i = 0; i < 2; i++) act(state, { type: 'BUY', id: 'worker' });
  act(state, { type: 'ENABLE_MANAGEMENT' });
  act(state, { type: 'SET_STAFF', staff: { sort: 0, pack: 0, load: 5 } });
  const original = copy(state), preview = copy(managementView(state).workers);
  assert.deepEqual(state, original, 'planning preview does not write state');
  act(state, { type: 'START' });
  assert.deepEqual(state.shift.flow.workers.map(({ x, y, ...worker }) => worker), preview.map(({ x, y, ...worker }) => worker), 'opening keeps planning identities and assignments');
  for (const a of preview) for (const b of preview) if (a.id !== b.id) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 54, 'planning touch targets have enough separation');
  advance(state, 8);
  const workers = state.shift.flow.workers;
  assert.equal(workers.length, 5);
  for (const worker of workers) {
    assert.equal(worker.phase, 'idle');
    assert.deepEqual({ x: worker.x, y: worker.y }, pipelineWorkerPoint('load', worker.id));
  }
  for (const a of workers) for (const b of workers) if (a.id !== b.id) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 28);
  const before = workers.map(worker => ({ id: worker.id, x: worker.x, y: worker.y }));
  advance(state, 1);
  assert.deepEqual(workers.map(worker => ({ id: worker.id, x: worker.x, y: worker.y })), before);
});

test('frozen real schema1 save migrates to management and survives continued play and two saves', () => {
  const raw = readFileSync(new URL('./fixtures/schema1-day3.json', import.meta.url), 'utf8');
  const data = new Map([[SAVE_KEY, raw]]);
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  let loaded = loadGame(storage);
  assert.equal(loaded.ok, true);
  let state = loaded.state;
  const cash = state.cash, history = copy(state.history), upgrades = copy(state.upgrades);
  act(state, { type: 'ENABLE_MANAGEMENT' });
  assert.equal(state.day, 3);
  assert.equal(state.cash, cash);
  assert.deepEqual(state.history, history);
  assert.deepEqual(state.upgrades, upgrades);
  act(state, { type: 'START' });
  advance(state, 12);
  assert.equal(saveGame(storage, state).ok, true);
  loaded = loadGame(storage);
  assert.equal(loaded.ok, true);
  state = loaded.state;
  advance(state, 15);
  assert.equal(saveGame(storage, state).ok, true);
  loaded = loadGame(storage);
  assert.equal(loaded.ok, true);
  state = loaded.state;
  advance(state, 999);
  assert.equal(saveGame(storage, state).ok, true);
  assert.equal(loadGame(storage).state.dayResult.delivered, state.dayResult.delivered);
  assert.equal(state.history.length, 3);
});

// Historical rule-one shifts retain the original arrival sequence and work clocks.
function originalFlow(state) {
  delete state.shift.flow.rules; delete state.shift.arrivals;
  state.shift.parcels=state.shift.parcels.slice(0,1);
  state.shift.parcels[0].kind=CONTENT.days[state.day-1].weights[0];
  state.shift.spawned=1; state.shift.nextId=2;
  return state;
}
test('historical rule-one rush order gains measured throughput from an extra bottleneck worker and equipment', () => {
  const base = automated({ day: 8, plan: 'rush' });
  const staffed = automated({ day: 8, plan: 'rush', upgrades: ['worker'], staff: { sort: 2, pack: 1, load: 1 } });
  const equipped = automated({ day: 8, plan: 'rush', upgrades: ['worker', 'packer', 'widegate'], staff: { sort: 2, pack: 1, load: 1 } });
  for (const state of [base, staffed, equipped]) { originalFlow(state); advance(state, 60); }
  assert.equal(base.shift.total, staffed.shift.total);
  assert.equal(staffed.shift.total, equipped.shift.total);
  assert.ok(staffed.shift.delivered > base.shift.delivered, `${base.shift.delivered} -> ${staffed.shift.delivered}`);
  assert.ok(equipped.shift.delivered > staffed.shift.delivered, `${staffed.shift.delivered} -> ${equipped.shift.delivered}`);
  for (const state of [base, staffed, equipped]) advance(state, 999);
  assert.ok(staffed.dayResult.delivered > base.dayResult.delivered);
  assert.ok(equipped.dayResult.delivered > staffed.dayResult.delivered);
});

test('running legacy processing and carried job migrate without resetting balances or remaining time', () => {
  let state = atDay(3);
  act(state, { type: 'START' });
  act(state, { type: 'PREPARE', id: state.shift.parcels[0].id });
  advance(state, 2.4);
  const normal = state.shift.parcels.find(parcel => parcel.kind === 'normal');
  assert.ok(normal);
  act(state, { type: 'SORT', id: normal.id, dest: normal.dest });
  advance(state, 0.2);
  const old = copy(state), source = old.shift.workers.find(worker => worker.parcel);
  assert.ok(source);
  const storage = storageFor(state);
  state = loadGame(storage).state;
  act(state, { type: 'ENABLE_MANAGEMENT' });
  assert.equal(state.cash, old.cash);
  assert.equal(state.shift.elapsed, old.shift.elapsed);
  assert.deepEqual(state.shift.processing, old.shift.processing);
  assert.deepEqual(state.upgrades, old.upgrades);
  const carried = state.shift.flow.workers.find(worker => worker.parcel?.id === source.parcel.id);
  assert.ok(carried);
  assert.ok(Math.abs(carried.job.remaining / carried.job.duration - (1 - source.progress)) < 1e-7);
  const migratedRemaining = carried.job.remaining;
  assert.equal(saveGame(storage, state).ok, true);
  state = loadGame(storage).state;
  advance(state, 1);
  assert.equal(state.shift.processing, null);
  const events = tick(state, Math.max(0, migratedRemaining - 1) + 0.001);
  assert.ok(events.some(event => event.type === 'loaded' && event.id === source.parcel.id), 'legacy freight completes after its original remaining seconds');
  assert.equal(saveGame(storage, state).ok, true);
  state = loadGame(storage).state;
  advance(state, 999);
  assert.equal(state.history.length, 3);
  assert.equal(saveGame(storage, state).ok, true);
});

test('historical rule-one eighteen management days remain winnable with earned cash and bottleneck staffing', () => {
  const state = createGame();
  act(state, { type: 'ENABLE_MANAGEMENT' });
  const purchases = { 5: ['worker'], 8: ['widegate'], 10: ['packer', 'dispatch'], 12: ['worker'], 13: ['scanner'], 15: ['sorter'] };
  for (let day = 1; day <= 18; day++) {
    for (const id of purchases[day] || []) act(state, { type: 'BUY', id });
    const extra = state.upgrades.worker || 0;
    act(state, { type: 'SET_STAFF', staff: day === 12 ? { sort: 2, pack: 2, load: 1 } : extra ? { sort: 2, pack: 1, load: extra } : { sort: 1, pack: 1, load: 1 } });
    act(state, { type: 'START' });
    originalFlow(state);
    advance(state, 999);
    assert.equal(state.dayResult.success, true, `day ${day}`);
    assert.equal(state.dayResult.delivered, state.shift.total, `day ${day} releases and delivers every parcel`);
    if (day < 18) act(state, { type: 'NEXT' });
  }
  assert.equal(state.phase, 'ending');
  assert.equal(state.history.length, 18);
});

test('pickup, work, delivery, return and transfer retain exact ownership through two reloads', () => {
  let state = automated();
  const storage = storageFor(state);
  state = loadGame(storage).state;
  const observed = new Set();
  for (let i = 0; i < 600 && observed.size < 5; i++) {
    advance(state, 0.1);
    const worker = state.shift.flow.workers[0];
    const phase = worker.phase;
    if (!['pickup', 'work', 'deliver', 'return', 'transfer'].includes(phase) || observed.has(phase)) continue;
    observed.add(phase);
    assert.equal(saveGame(storage, state).ok, true);
    const before = copy(state);
    state = loadGame(storage).state;
    assert.deepEqual(state, before);
    advance(state, 0.1);
    assert.equal(saveGame(storage, state).ok, true);
    state = loadGame(storage).state;
    if (phase === 'return') act(state, { type: 'SET_STAFF', staff: { sort: 0, pack: 2, load: 1 } });
  }
  assert.deepEqual([...observed].sort(), ['deliver', 'pickup', 'return', 'transfer', 'work']);
});

test('malformed ownership, phase, staffing and unknown management data are rejected without repair', () => {
  const state = automated();
  advance(state, 0.1);
  const badVariants = [
    s => s.shift.flow.load.push(copy(s.shift.flow.workers[0].parcel)),
    s => s.shift.flow.workers[0].job.stage = 'pack',
    s => { s.shift.flow.workers[0].job.duration = 0.1; s.shift.flow.workers[0].job.remaining = 0.1; },
    s => s.shift.flow.workers[0].phase = 'idle',
    s => s.shift.flow.workers[0].x = Infinity,
    s => s.management.staff.sort++,
    s => s.shift.flow.workers[0].targetRole = 'pack',
    s => s.shift.flow.extra = true,
    s => s.management.version = 2,
    s => s.shift.flow = null,
    s => s.shift.queues = null,
  ];
  for (const mutate of badVariants) {
    const bad = copy(state); mutate(bad);
    assert.equal(validate(bad).ok, false);
    const storage = storageFor(bad), raw = storage.getItem(SAVE_KEY);
    assert.equal(loadGame(storage).ok, false);
    assert.equal(storage.getItem(SAVE_KEY), raw);
  }
  const untouched = copy(state);
  assert.equal(dispatch(state, { type: 'SET_STAFF', staff: { sort: 2, pack: 2, load: 0 } }).ok, false);
  assert.deepEqual(state, untouched);
});

test('precise order previews match all released destinations and route premiums; ad reward remains once-only', () => {
  const state = automated({ plan: 'rush' });
  advance(state, 999);
  act(state, { type: 'BEGIN_AD', id: 'pipeline_ad_01' });
  const cash = state.cash;
  act(state, { type: 'GRANT_AD', id: 'pipeline_ad_01' });
  assert.equal(state.cash, cash + 20);
  assert.equal(dispatch(state, { type: 'GRANT_AD', id: 'pipeline_ad_01' }).ok, false);
  act(state, { type: 'NEXT' });
  const preview = orderPreview(state, { plan: 'rush', route: 1 });
  act(state, { type: 'START', plan: 'rush', route: 1 });
  const counts = [0, 0, 0], ids = new Set();
  while (state.phase === 'running') {
    const parcels = [...state.shift.parcels, ...state.shift.flow.pack, ...state.shift.flow.load, ...state.shift.flow.workers.map(worker => worker.parcel).filter(Boolean), ...state.shift.loading.flat()];
    for (const parcel of parcels) if (!ids.has(parcel.id)) { ids.add(parcel.id); counts[parcel.dest]++; }
    advance(state, 0.1);
  }
  // Some orders time out before release; preview is checked against the deterministic full manifest.
  const expected = [0, 0, 0];
  for (let i = 0; i < preview.total; i++) expected[i % 3 === 0 ? 1 : (i * 7 + state.day - 1) % 3]++;
  assert.deepEqual(preview.routeCounts, expected);
  assert.equal(preview.total, state.shift.total);
  assert.equal(preview.routeExtra, expected[1] * 2);
  assert.equal(preview.bonus, state.contract.bonus);
  assert.equal(preview.goal, state.contract.goal);
  assert.ok(counts.every((count, dest) => count <= expected[dest]));
  assert.equal(state.adRewards.grants.length, 1);
  assert.equal(validate(state).ok, true);
});


test('specific worker moves retain identity through planning, hire, opening, reload and next day', () => {
  let state = atDay(3);
  act(state, { type: 'ENABLE_MANAGEMENT' });
  act(state, { type: 'MOVE_WORKER', workerId: 2, role: 'load' });
  act(state, { type: 'MOVE_WORKER', workerId: 3, role: 'pack' });
  const assignments = [{ id: 1, targetRole: 'sort' }, { id: 2, targetRole: 'load' }, { id: 3, targetRole: 'pack' }];
  assert.deepEqual(state.management.assignments, assignments);
  assert.deepEqual(managementView(state).workers.map(({ id, role, targetRole, phase }) => ({ id, role, targetRole, phase })), assignments.map(({ id, targetRole }) => ({ id, role: targetRole, targetRole, phase: 'idle' })));
  const storage = storageFor();
  assert.equal(saveGame(storage, state).ok, true);
  state = loadGame(storage).state;
  act(state, { type: 'BUY', id: 'worker' });
  const hired = [...assignments, { id: 4, targetRole: 'load' }];
  assert.deepEqual(state.management.assignments, hired);
  act(state, { type: 'START' });
  assert.deepEqual(state.shift.flow.workers.map(({ id, targetRole }) => ({ id, targetRole })), hired);
  advance(state, 999);
  act(state, { type: 'NEXT' });
  assert.deepEqual(state.management.assignments, hired);
  assert.equal(saveGame(storage, state).ok, true);
  state = loadGame(storage).state;
  act(state, { type: 'START' });
  assert.deepEqual(state.shift.flow.workers.map(({ id, targetRole }) => ({ id, targetRole })), hired);
});

test('retargeting a chosen busy worker preserves its parcel and clock until it unloads', () => {
  let state = automated();
  let worker;
  for (let i = 0; i < 200; i++) {
    tick(state, 0.1);
    worker = state.shift.flow.workers.find(item => item.parcel && item.phase === 'work' && item.progress > 0);
    if (worker) break;
  }
  assert.ok(worker?.parcel);
  const before = copy(worker), others = copy(state.shift.flow.workers.filter(item => item.id !== worker.id));
  act(state, { type: 'MOVE_WORKER', workerId: worker.id, role: 'load' });
  act(state, { type: 'MOVE_WORKER', workerId: worker.id, role: 'pack' });
  assert.deepEqual({ ...worker, targetRole: before.targetRole }, before);
  assert.deepEqual(state.shift.flow.workers.filter(item => item.id !== worker.id), others);
  assert.equal(managementView(state).roles.pack.assigned, 2);
  const storage = storageFor();
  assert.equal(saveGame(storage, state).ok, true);
  state = loadGame(storage).state;
  worker = state.shift.flow.workers.find(item => item.id === before.id);
  assert.equal(worker.parcel.id, before.parcel.id);
  let completed = false;
  for (let i = 0; i < 500 && !completed; i++) {
    const events = tick(state, 0.05);
    completed = events.some(event => event.type === 'pipelineDone' && event.id === before.parcel.id && event.stage === before.role);
    if (!completed) { assert.equal(worker.role, before.role); assert.equal(worker.parcel.id, before.parcel.id); }
  }
  assert.ok(completed);
  assert.equal(worker.parcel, null);
  assert.equal(worker.phase, 'transfer');
  for (let i = 0; i < 100 && worker.role !== 'pack'; i++) tick(state, 0.05);
  assert.equal(worker.role, 'pack');
  assert.equal(validate(state).ok, true);
});

test('old management saves preserve running targets while strict optional assignments reject corruption', () => {
  const state = automated();
  act(state, { type: 'MOVE_WORKER', workerId: 2, role: 'load' });
  act(state, { type: 'MOVE_WORKER', workerId: 3, role: 'pack' });
  delete state.management.assignments;
  assert.equal(validate(state).ok, true);
  const storage = storageFor(state);
  let restored = loadGame(storage).state;
  advance(restored, 999);
  act(restored, { type: 'NEXT' });
  assert.deepEqual(restored.management.assignments.map(item => item.targetRole), ['sort', 'load', 'pack']);
  assert.equal(saveGame(storage, restored).ok, true);
  restored = loadGame(storage).state;
  const original = copy(restored);
  for (const assignments of [null, [], [{ id: 1, targetRole: 'sort' }],
    [{ id: 1, targetRole: 'sort' }, { id: 1, targetRole: 'load' }, { id: 3, targetRole: 'pack' }],
    [{ id: 1, targetRole: 'sort', extra: true }, { id: 2, targetRole: 'load' }, { id: 3, targetRole: 'pack' }],
    [{ id: 1, targetRole: 'sort' }, { id: 2, targetRole: 'sort' }, { id: 3, targetRole: 'pack' }]]) {
    const bad = copy(original); bad.management.assignments = assignments;
    assert.equal(validate(bad).ok, false);
  }
  for (const workerId of [0, 4, '2', null]) assert.equal(dispatch(restored, { type: 'MOVE_WORKER', workerId, role: 'pack' }).ok, false);
  assert.equal(dispatch(restored, { type: 'MOVE_WORKER', workerId: 2, role: 'unknown' }).ok, false);
  assert.deepEqual(restored, original);
});


test('legacy headcount staffing preserves selected identities and deterministically reassigns only excess workers', () => {
  const state = createGame();
  act(state, { type: 'ENABLE_MANAGEMENT' });
  act(state, { type: 'MOVE_WORKER', workerId: 2, role: 'load' });
  act(state, { type: 'MOVE_WORKER', workerId: 3, role: 'pack' });
  act(state, { type: 'SET_STAFF', staff: { sort: 1, pack: 1, load: 1 } });
  assert.deepEqual(state.management.assignments.map(item => item.targetRole), ['sort', 'load', 'pack']);
  act(state, { type: 'SET_STAFF', staff: { sort: 2, pack: 0, load: 1 } });
  assert.deepEqual(state.management.assignments.map(item => item.targetRole), ['sort', 'load', 'sort']);
  act(state, { type: 'START' });
  const bad = copy(state);
  bad.management.assignments = [{ id: 1, targetRole: 'sort' }, { id: 2, targetRole: 'sort' }, { id: 3, targetRole: 'load' }];
  assert.equal(validate(bad).ok, false, 'assignment counts matching headcounts cannot hide flow identity disagreement');
});
