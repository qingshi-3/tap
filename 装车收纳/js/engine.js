import { ITEMS, TRUCKS } from './content.js';
import { TRUCKS as LEGACY_TRUCKS } from './content-v1.js';

/** Pure rules over placements {x,y,r,z?}; omitted z is the floor. Frozen orders
 * retain departure-only safety rules and planar unloading. Current orders check
 * safety on placement and allow one fully supported upper layer.
 */
export function cellsFor(type, r = 0) {
  const item = typeof type === 'string' ? ITEMS[type] : type;
  if (!item?.cells || !Number.isInteger(r)) return [];
  let cells = item.cells.map(([x, y]) => [x, y]);
  for (let i = 0; i < ((r % 4) + 4) % 4; i++) cells = cells.map(([x, y]) => [-y, x]);
  const minX = Math.min(...cells.map(c => c[0]));
  const minY = Math.min(...cells.map(c => c[1]));
  return cells.map(([x, y]) => [x - minX, y - minY]);
}

const legacy = order => order.rules?.stacking === undefined && order.rules?.unloadOrder === undefined;
const key = (x, y) => x + ',' + y;
const layer = p => p.z ?? 0;
const cargoFor = (order, id) => order.cargo.find(c => c.id === id);
const worldCells = (cargo, p) => cellsFor(cargo.type, p.r ?? 0).map(([x, y]) => [x + p.x, y + p.y]);
const failure = (reason, code = 'placement') => ({ ok: false, reason, code });

export function truckFor(order) {
  const truck = (legacy(order) ? LEGACY_TRUCKS : TRUCKS).find(t => t.id === order.truckId);
  if (!truck) throw new Error('Unknown truck: ' + order.truckId);
  return order.door ? { ...truck, door: [...order.door] } : truck;
}

/** Geometry/support only. Missing cargo is legal during loading/unloading.
 * Excluding departure checks preserves unfinished and frozen saved layouts.
 */
export function validateLayout(order, placements) {
  const truck = truckFor(order), issues = [], occupied = new Map(), floor = new Map();
  const obstacles = new Set((order.obstacles ?? []).map(([x, y]) => key(x, y)));
  const add = (id, code, message) => issues.push({ id, code, message });
  for (const cargo of order.cargo) {
    const p = placements[cargo.id];
    if (!p) continue;
    const item = ITEMS[cargo.type], z = layer(p), r = p.r ?? 0;
    if (!item) { add(cargo.id, 'placement', '货物不存在'); continue; }
    if (![p.x, p.y, r, z].every(Number.isInteger) || r < 0 || r > 3 || z < 0 || z > 1) {
      add(cargo.id, 'placement', '位置、朝向或层数无效'); continue;
    }
    if (z && !order.rules?.stacking) { add(cargo.id, 'stacking', '这单只能平放装车'); continue; }
    if (z && (item.heavy || item.cells.length > 2)) {
      add(cargo.id, 'stacking', item.heavy ? '重物只能放在地板上' : '只有一格或两格轻货能放上层'); continue;
    }
    for (const [x, y] of worldCells(cargo, p)) {
      const cell = key(x, y), slot = z + ':' + cell;
      if (x < 0 || x >= truck.w || y < 0 || y >= truck.h) add(cargo.id, 'placement', '超出车厢');
      else if (obstacles.has(cell) || occupied.has(slot)) add(cargo.id, 'placement', '这里被占用了');
      occupied.set(slot, cargo);
      if (!z) floor.set(cell, cargo);
    }
  }
  if (order.rules?.stacking) {
    for (const cargo of order.cargo) {
      const p = placements[cargo.id];
      if (!p || layer(p) !== 1 || !ITEMS[cargo.type]) continue;
      const beneath = worldCells(cargo, p).map(([x, y]) => floor.get(key(x, y)));
      if (beneath.some(base => base && ITEMS[base.type].fragile)) add(cargo.id, 'fragileSupport', '易碎品不能承重，上面不能放货');
      else if (beneath.some(base => base && !ITEMS[base.type].support)) add(cargo.id, 'support', '只有纸箱和收纳箱能承重');
      else if (beneath.some(base => !base)) add(cargo.id, 'support', '上层货物必须被下层箱子完全托住');
    }
  }
  return { ok: issues.length === 0, reason: issues[0]?.message ?? '', issues };
}

function cargoRule(order, cargo, p) {
  const item = ITEMS[cargo.type], truck = truckFor(order), cells = worldCells(cargo, p);
  if (order.rules?.heavyFront && item.heavy && cells.some(([, y]) => y >= Math.ceil(truck.h / 2))) {
    return failure(item.name + '须全部放在车厢前半区', 'heavyFront');
  }
  if (order.rules?.longSecured && item.long) {
    const vertical = cells.every(([x]) => x === cells[0][0]);
    const horizontal = cells.every(([, y]) => y === cells[0][1]);
    const secured = (vertical && (cells[0][0] === 0 || cells[0][0] === truck.w - 1)) || (horizontal && cells[0][1] === 0);
    if (!secured) return failure(item.name + '须沿车头或侧墙贴齐固定', 'longSecured');
  }
  return { ok: true, reason: '' };
}

export function canPlace(order, placements, id, x, y, r = 0, z = 0) {
  const cargo = cargoFor(order, id);
  if (!cargo || !ITEMS[cargo.type]) return failure('货物不存在');
  const next = { ...placements, [id]: { x, y, r, z } };
  const layout = validateLayout(order, next);
  if (!layout.ok) return failure(layout.reason, layout.issues[0].code);
  if (!legacy(order)) return cargoRule(order, cargo, next[id]);
  return { ok: true, reason: '' };
}

export const tryPlace = canPlace;

/** Lower cargo cannot be picked up while an upper footprint overlaps it. */
export function canRemove(order, placements, id) {
  const cargo = cargoFor(order, id), p = placements[id];
  if (!cargo || !p) return { ok: false, reason: '货物还未装车' };
  if (!layer(p)) {
    const footprint = new Set(worldCells(cargo, p).map(([x, y]) => key(x, y)));
    if (order.cargo.some(other => other.id !== id && placements[other.id] && layer(placements[other.id]) === 1 && worldCells(other, placements[other.id]).some(([x, y]) => footprint.has(key(x, y))))) {
      return { ok: false, reason: '先拿走上面的货物，才能移动下层箱子' };
    }
  }
  return { ok: true, reason: '' };
}

/** Fixed-orientation floor routes cross only the rear door. Early orders and all
 * upper cargo lift out directly. Floor cargo must first release upper dependants.
 * Routes remain {x,y}[] for the existing renderer's animation contract.
 */
export function unloadPath(order, placements, id) {
  const cargo = cargoFor(order, id), start = placements[id];
  if (!cargo || !start || !validateLayout(order, placements).ok || !canRemove(order, placements, id).ok) return null;
  if (order.rules?.unloadOrder === true && order.cargo.some(other => placements[other.id] && other.stop < cargo.stop)) return null;
  const truck = truckFor(order);
  if (order.rules?.unloadOrder === false || layer(start) === 1) {
    return [{ x: start.x, y: start.y }, { x: start.x, y: truck.h }];
  }
  const cells = cellsFor(cargo.type, start.r ?? 0);
  const occupied = new Set((order.obstacles ?? []).map(([x, y]) => key(x, y)));
  for (const other of order.cargo) {
    const p = placements[other.id];
    if (other.id !== id && p && (!layer(p) || legacy(order))) {
      for (const [x, y] of worldCells(other, p)) occupied.add(key(x, y));
    }
  }
  function clear(x, y) {
    return cells.every(([dx, dy]) => {
      const a = x + dx, b = y + dy;
      if (a < 0 || a >= truck.w || b < 0) return false;
      if (b >= truck.h) return a >= truck.door[0] && a <= truck.door[1];
      return !occupied.has(key(a, b));
    });
  }
  const queue = [{ x: start.x, y: start.y }], parents = new Map([[key(start.x, start.y), null]]);
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    if (current.y >= truck.h) {
      const path = [];
      for (let p = current; p; p = parents.get(key(p.x, p.y))) path.push(p);
      return path.reverse();
    }
    for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1]]) {
      const x = current.x + dx, y = current.y + dy;
      if (y > truck.h || parents.has(key(x, y)) || !clear(x, y)) continue;
      parents.set(key(x, y), current); queue.push({ x, y });
    }
  }
  return null;
}

export function inspect(order, placements) {
  const layout = validateLayout(order, placements), issues = [...layout.issues];
  let loaded = 0;
  for (const cargo of order.cargo) {
    const p = placements[cargo.id], item = ITEMS[cargo.type];
    if (!p) { issues.push({ id: cargo.id, code: 'missing', message: item.name + '还未装车' }); continue; }
    loaded++;
    if (!layout.ok) continue;
    const rule = cargoRule(order, cargo, p);
    if (!rule.ok) issues.push({ id: cargo.id, code: rule.code, message: rule.reason });
    // Frozen adjacency semantics do not apply to the new fragile cargo rule.
    if (legacy(order) && order.rules?.fragileBuffer && item.fragile) {
      const neighbors = new Set(worldCells(cargo, p).flatMap(([x, y]) => [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]).map(([x, y]) => key(x, y)));
      if (order.cargo.some(other => ITEMS[other.type].heavy && placements[other.id] && worldCells(other, placements[other.id]).some(([x, y]) => neighbors.has(key(x, y))))) {
        issues.push({ id: cargo.id, code: 'fragileBuffer', message: item.name + '不能紧贴重物，须留一格缓冲' });
      }
    }
  }
  // Removing reachable pieces frees space/support dependencies, so greedy removal
  // is complete within a stop. Later-stop supports may never leave early.
  if (loaded === order.cargo.length && layout.ok) {
    const remaining = { ...placements };
    for (let stop = 0; stop < order.stops.length; stop++) {
      const pending = order.cargo.filter(c => c.stop === stop);
      while (pending.length) {
        const next = pending.findIndex(c => unloadPath(order, remaining, c.id));
        if (next < 0) {
          for (const cargo of pending) {
            const removal = canRemove(order, remaining, cargo.id);
            issues.push({ id: cargo.id, code: 'blocked', message: '第' + (stop + 1) + '站：' + (removal.ok ? ITEMS[cargo.type].name + '无法从尾门卸出' : removal.reason) });
          }
          break;
        }
        delete remaining[pending[next].id]; pending.splice(next, 1);
      }
      if (pending.length) break;
    }
  }
  return { ready: issues.length === 0, issues, loaded, total: order.cargo.length };
}

