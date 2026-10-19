import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, TRUCKS, ORDERS, CONTRACTS, getOrder } from '../js/content.js';
import { ITEMS as LEGACY_ITEMS, TRUCKS as LEGACY_TRUCKS, ORDERS as LEGACY_ORDERS } from '../js/content-v1.js';
import { cellsFor, truckFor, canPlace, tryPlace, canRemove, validateLayout, inspect, unloadPath } from '../js/engine.js';

const key = (x, y) => x + ',' + y;
const fixture = (cargo, options = {}) => ({
  id: 'test', truckId: 'van', cargo, stops: ['第一站', '第二站'],
  obstacles: [], rules: {}, ...options,
});
const current = (cargo, rules = {}, options = {}) => fixture(cargo, {
  ...options, rules: { stacking: true, unloadOrder: false, ...rules },
});

// Verify floor routes independently: one-cell translations, fixed orientation,
// occupied floor cells and every bottom-wall crossing. Lift-out routes have no
// planar collision requirement, but may not take a lower piece out under cargo.
function verifyPath(order, placements, id, path) {
  assert.ok(path?.length > 1, id + ' has a departure path');
  const truck = truckFor(order), cargo = order.cargo.find(c => c.id === id), start = placements[id];
  assert.deepEqual(path[0], { x: start.x, y: start.y });
  const own = new Set(cellsFor(cargo.type, start.r).map(([x, y]) => key(x + start.x, y + start.y)));
  if (!(start.z ?? 0)) {
    for (const other of order.cargo) {
      const p = placements[other.id];
      if (p?.z !== 1) continue;
      assert.ok(cellsFor(other.type, p.r).every(([x, y]) => !own.has(key(x + p.x, y + p.y))), 'support cannot leave under upper cargo');
    }
  }
  if (order.rules?.unloadOrder === false || start.z === 1) {
    assert.deepEqual(path, [{ x: start.x, y: start.y }, { x: start.x, y: truck.h }]);
    return;
  }
  const occupied = new Set(order.obstacles.map(([x, y]) => key(x, y)));
  for (const other of order.cargo) {
    const p = placements[other.id];
    if (!p || other.id === id || p.z === 1) continue;
    for (const [dx, dy] of cellsFor(other.type, p.r)) occupied.add(key(p.x + dx, p.y + dy));
  }
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    if (i) assert.equal(Math.abs(p.x - path[i - 1].x) + Math.abs(p.y - path[i - 1].y), 1);
    for (const [dx, dy] of cellsFor(cargo.type, start.r)) {
      const x = p.x + dx, y = p.y + dy;
      assert.ok(x >= 0 && x < truck.w && y >= 0);
      if (y < truck.h) assert.equal(occupied.has(key(x, y)), false, id + ' route collides at ' + key(x, y));
      else assert.ok(x >= truck.door[0] && x <= truck.door[1], id + ' exits through a wall');
    }
  }
  assert.ok(path.at(-1).y >= truck.h, 'the complete item has left the vehicle');
}

for (const [version, orders] of [['v2', ORDERS], ['v1', [...LEGACY_ORDERS, ...CONTRACTS]]]) {
  for (const order of orders) {
    test(version + ' ' + order.id + ': authored loading and complete delivery', () => {
      const before = JSON.stringify(order), placements = {};
      for (const cargo of order.cargo) {
        const p = order.solution[cargo.id];
        assert.ok(p && ITEMS[cargo.type]);
        assert.ok(Number.isInteger(cargo.stop) && cargo.stop >= 0 && cargo.stop < order.stops.length);
        const result = canPlace(order, placements, cargo.id, p.x, p.y, p.r, p.z ?? 0);
        assert.equal(result.ok, true, cargo.id + ': ' + result.reason);
        placements[cargo.id] = { ...p };
      }
      const snapshot = JSON.stringify(placements);
      assert.equal(validateLayout(order, placements).ok, true);
      assert.deepEqual(inspect(order, placements), { ready: true, issues: [], loaded: order.cargo.length, total: order.cargo.length });
      assert.equal(JSON.stringify(placements), snapshot, 'inspection never consumes cargo');
      let delivered = 0;
      for (let stop = 0; stop < order.stops.length; stop++) {
        const pending = order.cargo.filter(c => c.stop === stop);
        while (pending.length) {
          const index = pending.findIndex(c => unloadPath(order, placements, c.id));
          assert.ok(index >= 0, 'stop ' + stop + ' unloads without removing later cargo');
          const [cargo] = pending.splice(index, 1);
          verifyPath(order, placements, cargo.id, unloadPath(order, placements, cargo.id));
          delete placements[cargo.id]; delivered++;
          assert.equal(validateLayout(order, placements).ok, true, 'every intermediate remaining stack stays supported');
        }
      }
      assert.equal(delivered, order.cargo.length);
      assert.deepEqual(placements, {});
      assert.equal(JSON.stringify(order), before, 'shared authored content stays unchanged');
    });
  }
}

test('current content preserves every old footprint and resolves frozen campaign orders explicitly', () => {
  for (const [id, item] of Object.entries(LEGACY_ITEMS)) assert.deepEqual(ITEMS[id].cells, item.cells);
  assert.equal(ITEMS.vase.fragile, true);
  assert.equal(ITEMS.vase.support, undefined);
  assert.deepEqual(Object.values(ITEMS).filter(item => item.support).map(item => item.id), ['crate', 'chest']);
  for (const old of LEGACY_ORDERS) {
    assert.equal(getOrder(old.id, 1), old);
    assert.equal(getOrder(old.id), ORDERS.find(order => order.id === old.id));
    assert.notEqual(getOrder(old.id), old);
  }
  assert.equal(getOrder('c01', 1), undefined, 'unexposed contracts never become playable saves');
  assert.equal(getOrder('unknown'), undefined);
  assert.equal(getOrder('o01', 3), undefined, 'future content is never guessed');
  for (const truck of TRUCKS) {
    const old = LEGACY_TRUCKS.find(item => item.id === truck.id);
    assert.deepEqual([truck.w, truck.h, truck.price, truck.unlockAfter], [old.w, old.h, old.price, old.unlockAfter]);
  }
});

test('mechanics arrive in stages, dense introduction orders cannot all fit on the floor', () => {
  assert.equal(ORDERS.length, 25);
  for (let i = 0; i < ORDERS.length; i++) {
    const order = ORDERS[i], number = i + 1, truck = truckFor(order);
    assert.equal(order.rules.stacking, number >= 5);
    assert.equal(order.rules.unloadOrder, number >= 15);
    assert.equal(Boolean(order.rules.heavyFront), number >= 11);
    assert.equal(Boolean(order.rules.longSecured), number >= 13);
    assert.equal(order.rules.fragileBuffer, undefined);
    if (number < 15) assert.equal(order.stops.length, 1);
    if (number < 8) assert.ok(order.cargo.every(cargo => !ITEMS[cargo.type].fragile));
    if (number < 11) assert.ok(order.cargo.every(cargo => !ITEMS[cargo.type].heavy));
    if (number < 19) {
      assert.deepEqual(truck.door, [0, truck.w - 1]);
      assert.deepEqual(order.obstacles, []);
    } else assert.ok(truck.door[1] - truck.door[0] + 1 < truck.w);
  }
  for (const order of ORDERS.slice(4, 7)) {
    const truck = truckFor(order);
    assert.ok(order.cargo.reduce((sum, cargo) => sum + ITEMS[cargo.type].cells.length, 0) > truck.w * truck.h, order.id + ' requires stacking');
    assert.ok(Object.values(order.solution).some(p => p.z === 1));
  }
});

test('rotation preserves footprints and normalizes upper-left origins', () => {
  assert.deepEqual(cellsFor('chair', 1), [[1,0],[0,0],[0,1]]);
  for (const item of Object.values(ITEMS)) {
    const original = new Set(item.cells.map(([x,y]) => key(x,y)));
    assert.deepEqual(new Set(cellsFor(item.id, 4).map(([x,y]) => key(x,y))), original);
    for (let r = 0; r < 4; r++) {
      const cells = cellsFor(item.id, r);
      assert.equal(new Set(cells.map(([x,y]) => key(x,y))).size, item.cells.length);
      assert.equal(Math.min(...cells.map(c => c[0])), 0);
      assert.equal(Math.min(...cells.map(c => c[1])), 0);
    }
  }
});

test('floor placement handles boundaries, obstacles, rotation, collisions and moving the same cargo', () => {
  const o = current([{ id: 'a', type: 'chair', stop: 0 }, { id: 'b', type: 'crate', stop: 0 }], {}, { obstacles: [[3,3]] });
  const p = { a: { x: 0, y: 0, r: 0 }, b: { x: 2, y: 2, r: 0 } };
  assert.equal(canPlace(o, p, 'a', 0, 0, 0).ok, true);
  for (const [x,y,r] of [[2,1,0],[2,2,0],[-1,0,0],[3,4,0]]) assert.equal(canPlace(o, p, 'a', x,y,r).ok, false);
  assert.equal(canPlace(o, p, 'b', 3, 3).ok, false);
  assert.equal(canPlace(o, p, 'b', 0.5, 3).ok, false);
  assert.equal(tryPlace(o, p, 'b', 0, 4, 4).ok, false);
  assert.equal(canPlace(o, p, 'absent', 0, 0).ok, false);
  assert.equal(canPlace(o, p, 'b', 1, 3, 0, -1).ok, false);
  assert.equal(canPlace(o, p, 'b', 1, 3, 0, 2).ok, false);
  assert.equal(canPlace(o, p, 'b', 1, 3, 0, 0.5).ok, false);
});

test('upper cargo needs a full box support footprint, including both cells after rotation', () => {
  const o = current([
    { id: 'left', type: 'crate', stop: 0 }, { id: 'right', type: 'crate', stop: 0 },
    { id: 'upper', type: 'chest', stop: 0 }, { id: 'large', type: 'chair', stop: 0 },
    { id: 'heavy', type: 'fridge', stop: 0 },
  ]);
  const p = { left: { x: 0, y: 0 }, right: { x: 1, y: 0 } };
  assert.equal(canPlace(o, p, 'upper', 0, 0, 0, 1).ok, true, 'a long box may bridge two touching supports');
  const original = JSON.stringify(p);
  assert.match(canPlace(o, p, 'upper', 0, 0, 1, 1).reason, /完全托住/);
  assert.match(canPlace(o, p, 'upper', 1, 0, 0, 1).reason, /完全托住/);
  assert.match(canPlace(o, p, 'large', 0, 0, 0, 1).reason, /一格或两格/);
  assert.match(canPlace(o, p, 'heavy', 0, 0, 0, 1).reason, /重物只能/);
  assert.equal(JSON.stringify(p), original, 'rejected drops never alter the load');
  assert.equal(canPlace({ ...o, rules: { stacking: false, unloadOrder: false } }, p, 'upper', 0, 0, 0, 1).ok, false);
});

test('fragile cargo may sit above boxes and touch heavy cargo but can never support or be crushed', () => {
  const o = current([
    { id: 'box', type: 'chest', stop: 0 }, { id: 'vase', type: 'vase', stop: 0 },
    { id: 'top', type: 'crate', stop: 0 }, { id: 'heavy', type: 'washer', stop: 0 },
  ]);
  const p = { box: { x: 0, y: 0 }, vase: { x: 0, y: 0, z: 1 } };
  assert.equal(validateLayout(o, p).ok, true);
  assert.equal(canPlace(o, { vase: { x: 2, y: 2 } }, 'top', 2, 2, 0, 1).code, 'fragileSupport');
  assert.match(canPlace(o, { vase: { x: 2, y: 2 } }, 'top', 2, 2, 0, 1).reason, /易碎品不能承重/);
  const adjacent = { heavy: { x: 0, y: 0 }, vase: { x: 2, y: 1 }, box: { x: 0, y: 3 }, top: { x: 3, y: 4 } };
  assert.equal(inspect(o, adjacent).ready, true, 'no universal fragile buffer in new orders');
  assert.equal(canPlace(o, { top: { x: 2, y: 2, z: 1 } }, 'vase', 2, 2).code, 'fragileSupport', 'loading fragile beneath an existing upper piece is also blocked');
  assert.match(canPlace(o, { heavy: { x: 0, y: 0 } }, 'top', 0, 0, 0, 1).reason, /只有纸箱和收纳箱/);
});

test('upper collisions, support movement and lower removal preserve stacks without floating cargo', () => {
  const o = current([{ id: 'base', type: 'chest', stop: 0 }, { id: 'upper', type: 'crate', stop: 0 }, { id: 'other', type: 'plant', stop: 0 }]);
  const p = { base: { x: 0, y: 0 }, upper: { x: 0, y: 0, z: 1 } };
  assert.equal(canPlace(o, p, 'other', 0, 0, 0, 1).ok, false, 'upper pieces cannot overlap');
  assert.equal(canPlace(o, p, 'other', 1, 0, 0, 1).ok, true, 'unused support area remains usable');
  assert.equal(canPlace(o, p, 'base', 1, 0).ok, false, 'moving support cannot strand the upper cargo');
  assert.equal(canPlace(o, p, 'base', 0, 1).ok, false);
  assert.equal(canPlace(o, p, 'base', 0, 0, 1).ok, true, 'support may rotate if the upper footprint remains fully covered');
  assert.equal(canRemove(o, p, 'base').ok, false);
  assert.equal(unloadPath(o, p, 'base'), null);
  assert.equal(canRemove(o, p, 'upper').ok, true);
  assert.ok(unloadPath(o, p, 'upper'));
  const remaining = { base: p.base };
  assert.equal(canRemove(o, remaining, 'base').ok, true);
  assert.equal(canPlace(o, remaining, 'base', 1, 0).ok, true);
  assert.equal(canRemove(o, {}, 'base').ok, false);
  assert.equal(validateLayout(o, { upper: p.upper }).ok, false, 'persisted dangling upper cargo is invalid');
  assert.equal(validateLayout(o, { base: p.base, upper: { ...p.upper, z: 2 } }).ok, false, 'a third layer never exists');
});

test('current heavy/front and long securing reject drops immediately while persistence geometry stays valid', () => {
  const o = current([{ id: 'h', type: 'fridge', stop: 0 }, { id: 'l', type: 'mirror', stop: 0 }], { heavyFront: true, longSecured: true });
  assert.equal(canPlace(o, {}, 'h', 0, 1).code, 'heavyFront', 'every heavy cell must lie in ceil(h/2) front rows');
  assert.equal(canPlace(o, {}, 'h', 0, 0).ok, true);
  assert.equal(canPlace(o, {}, 'h', 0, 2, 1).code, 'longSecured', 'front half alone is not a securing wall');
  assert.equal(canPlace(o, {}, 'h', 0, 0, 1).ok, true);
  assert.equal(canPlace(o, {}, 'l', 1, 0).code, 'longSecured', 'an endpoint touching the front wall does not secure a vertical long edge');
  assert.equal(canPlace(o, {}, 'l', 3, 1).ok, true);
  assert.equal(canPlace(o, {}, 'l', 0, 0, 1).ok, true);
  const invalidDeparture = { h: { x: 0, y: 1 }, l: { x: 2, y: 1 } };
  assert.equal(validateLayout(o, invalidDeparture).ok, true);
  const issues = inspect(o, invalidDeparture).issues;
  assert.ok(issues.some(issue => issue.code === 'heavyFront'));
  assert.ok(issues.some(issue => issue.code === 'longSecured'));
});

test('flat no-order puzzles can depart and lift cargo without reserving a planar route', () => {
  const cargo = [{ id: 'inside', type: 'crate', stop: 0 }, { id: 'wallL', type: 'sofa', stop: 0 }, { id: 'wallR', type: 'sofa', stop: 0 }];
  const p = { inside: { x: 0, y: 0 }, wallL: { x: 0, y: 2, r: 1 }, wallR: { x: 2, y: 2, r: 1 } };
  const o = current(cargo, { stacking: false, unloadOrder: false });
  assert.equal(inspect(o, p).ready, true);
  assert.ok(unloadPath(o, p, 'inside'), 'the introductory flat puzzle has no route trap');
  assert.equal(unloadPath(fixture(cargo), p, 'inside'), null, 'frozen order keeps its original planar trap');
});

test('same-stop stacks unload upper first; earlier upper on later support is valid; later upper blocks earlier support', () => {
  const cargo = [{ id: 'base', type: 'chest', stop: 0 }, { id: 'upper', type: 'vase', stop: 0 }];
  const p = { base: { x: 0, y: 3 }, upper: { x: 0, y: 3, z: 1 } };
  const same = current(cargo, { unloadOrder: true });
  assert.equal(inspect(same, p).ready, true);
  assert.equal(unloadPath(same, p, 'base'), null);
  assert.ok(unloadPath(same, p, 'upper'));
  assert.ok(unloadPath(same, { base: p.base }, 'base'));
  const good = current([{ ...cargo[0], stop: 1 }, cargo[1]], { unloadOrder: true });
  assert.equal(inspect(good, p).ready, true);
  assert.equal(unloadPath(good, p, 'base'), null, 'later stop must stay until its turn');
  const bad = current([cargo[0], { ...cargo[1], stop: 1 }], { unloadOrder: true });
  assert.equal(validateLayout(bad, p).ok, true);
  assert.equal(unloadPath(bad, p, 'upper'), null, 'a later upper cannot be lifted early to rescue the current stop');
  assert.equal(inspect(bad, p).ready, false);
  assert.ok(inspect(bad, p).issues.some(issue => issue.id === 'base' && issue.code === 'blocked'));
});

test('floor route ignores upper layer at other footprints but never its own carried upper', () => {
  const o = current([
    { id: 'moving', type: 'crate', stop: 0 }, { id: 'base', type: 'chest', stop: 1 }, { id: 'upper', type: 'crate', stop: 1 },
  ], { unloadOrder: true }, { obstacles: [[0,3],[0,4],[2,3],[2,4],[3,3],[3,4]] });
  const p = { moving: { x: 1, y: 2 }, base: { x: 2, y: 0 }, upper: { x: 2, y: 0, z: 1 } };
  const path = unloadPath(o, p, 'moving');
  verifyPath(o, p, 'moving', path);
  assert.equal(canRemove(o, p, 'base').ok, false);
  assert.equal(unloadPath(o, p, 'base'), null);
});

test('frozen heavy/front remains a departure constraint and frozen fragile buffers keep edge/diagonal semantics', () => {
  const o = fixture([{ id: 'h', type: 'fridge', stop: 0 }], { rules: { heavyFront: true } });
  const p = { h: { x: 0, y: 1 } };
  assert.equal(canPlace(o, p, 'h', 0, 1).ok, true);
  assert.equal(validateLayout(o, p).ok, true);
  assert.ok(inspect(o, p).issues.some(issue => issue.code === 'heavyFront'));
  assert.equal(inspect(o, { h: { x: 0, y: 0 } }).ready, true);
  assert.equal(inspect(o, { h: { x: 0, y: 2, r: 1 } }).ready, true);
  const buffer = fixture([{ id: 'h', type: 'washer', stop: 1 }, { id: 'f', type: 'plant', stop: 0 }, { id: 'c', type: 'crate', stop: 0 }], { rules: { fragileBuffer: true } });
  const placed = { h: { x: 0, y: 0 }, f: { x: 2, y: 1 }, c: { x: 3, y: 2 } };
  assert.equal(canPlace(buffer, placed, 'f', 2, 1).ok, true);
  assert.equal(validateLayout(buffer, placed).ok, true);
  assert.ok(inspect(buffer, placed).issues.some(issue => issue.code === 'fragileBuffer'));
  placed.f = { x: 2, y: 2 };
  assert.equal(inspect(buffer, placed).ready, true);
});

test('ordered departure detects current and later-stop traps and permits same-stop blockers to leave first', () => {
  const cargo = [{ id: 'early', type: 'crate', stop: 0 }, { id: 'left', type: 'sofa', stop: 1 }, { id: 'right', type: 'sofa', stop: 1 }];
  const p = { early: { x: 0, y: 0 }, left: { x: 0, y: 2, r: 1 }, right: { x: 2, y: 2, r: 1 } };
  for (const o of [fixture(cargo), current(cargo, { unloadOrder: true })]) {
    assert.equal(unloadPath(o, p, 'early'), null);
    assert.ok(inspect(o, p).issues.some(issue => issue.id === 'early' && issue.code === 'blocked'));
    assert.equal(inspect({ ...o, cargo: cargo.map(item => ({ ...item, stop: 0 })) }, p).ready, true);
  }
  const later = current([{ id: 'first', type: 'crate', stop: 0 }, { id: 'second', type: 'crate', stop: 1 }, { id: 'wallL', type: 'sofa', stop: 2 }, { id: 'wallR', type: 'sofa', stop: 2 }], { unloadOrder: true }, { stops: ['一', '二', '三'] });
  const blocked = { first: { x: 0, y: 4 }, second: { x: 0, y: 0 }, wallL: { x: 0, y: 1, r: 1 }, wallR: { x: 2, y: 1, r: 1 } };
  assert.ok(unloadPath(later, blocked, 'first'));
  assert.ok(inspect(later, blocked).issues.some(issue => issue.id === 'second' && issue.code === 'blocked'));
});

test('door overrides are local and BFS turns around obstacles without crossing side/closed walls', () => {
  const old = fixture([{ id: 'a', type: 'crate', stop: 0 }], { truckId: 'long', obstacles: [[0,7]] });
  const p = { a: { x: 0, y: 6 } }, path = unloadPath(old, p, 'a');
  verifyPath(old, p, 'a', path);
  assert.ok(path.some(point => point.x > 0));
  assert.deepEqual(truckFor(old).door, [1,3], 'frozen narrow door remains unchanged');
  const currentOrder = { ...old, rules: { stacking: true, unloadOrder: true } };
  assert.deepEqual(truckFor(currentOrder).door, [0,4], 'current long truck starts with a full-width door');
  const narrow = { ...currentOrder, door: [2,2] };
  assert.deepEqual(truckFor(narrow).door, [2,2]);
  verifyPath(narrow, p, 'a', unloadPath(narrow, p, 'a'));
  assert.deepEqual(truckFor(currentOrder).door, [0,4], 'an order override never mutates the shared truck');
  const sealed = { ...old, obstacles: [[0,7],[1,7],[2,7],[3,7],[4,7]] };
  assert.equal(unloadPath(sealed, p, 'a'), null);
  const tooWide = current([{ id: 'wide', type: 'chest', stop: 0 }], { unloadOrder: true }, { door: [1,1] });
  assert.equal(unloadPath(tooWide, { wide: { x: 0, y: 0 } }, 'wide'), null);
});

test('missing and malformed layouts cannot pass departure; failed checks leave input untouched', () => {
  const order = ORDERS[0], empty = inspect(order, {});
  assert.equal(empty.ready, false);
  assert.equal(empty.loaded, 0);
  assert.equal(empty.total, order.cargo.length);
  assert.ok(empty.issues.every(issue => issue.code === 'missing'));
  const p = structuredClone(order.solution);
  p[order.cargo[0].id].x = -1;
  const before = JSON.stringify(p);
  assert.equal(inspect(order, p).ready, false);
  assert.equal(validateLayout(order, p).ok, false);
  assert.equal(unloadPath(order, p, order.cargo[0].id), null);
  assert.equal(unloadPath(order, {}, order.cargo[0].id), null);
  assert.equal(JSON.stringify(p), before);
});

test('truck upgrades remain affordable from first-completion base rewards without repeats', () => {
  let earned = 0, spent = 0;
  for (let completed = 0; completed <= ORDERS.length; completed++) {
    for (const truck of TRUCKS.filter(t => t.unlockAfter === completed)) {
      assert.ok(earned - spent >= truck.price, truck.id + ' is affordable when unlocked');
      spent += truck.price;
    }
    if (completed < ORDERS.length) earned += ORDERS[completed].reward;
  }
});

