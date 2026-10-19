import { TRUCKS, getOrder } from './content.js';
import { validateLayout } from './engine.js';

export const SAVE_KEY = 'cargo-packer.save.v1';
export const BACKUP_KEY = `${SAVE_KEY}.backup`;

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
function requireValue(condition, message) {
  if (!condition) throw fail('INVALID_SAVE', `存档无效：${message}`);
}
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const count = value => Number.isSafeInteger(value) && value >= 0;
const clone = value => JSON.parse(JSON.stringify(value));

export function freshSave() {
  return { schema: 2, revision: 0, coins: 0, ownedTrucks: [TRUCKS[0].id], completed: {}, active: null, sound: true };
}

const contentVersionFor = save => save.schema === 1 ? 1 : save.active.contentVersion;
const activeOrderFor = save => getOrder(save.active.orderId, contentVersionFor(save));

export function validateSave(value) {
  requireValue(record(value), '数据结构');
  requireValue(value.schema === 1 || value.schema === 2, '不支持的版本，原档已保留');
  requireValue(count(value.revision), '版本计数');
  requireValue(count(value.coins), '金币');
  requireValue(typeof value.sound === 'boolean', '声音开关');
  requireValue(Array.isArray(value.ownedTrucks) && value.ownedTrucks.length > 0, '车辆列表');
  requireValue(new Set(value.ownedTrucks).size === value.ownedTrucks.length, '车辆重复');
  requireValue(value.ownedTrucks.every(id => TRUCKS.some(truck => truck.id === id)), '未知车辆');
  requireValue(value.ownedTrucks.includes(TRUCKS[0].id), '初始车辆缺失');
  requireValue(record(value.completed), '完成记录');
  for (const [id, completion] of Object.entries(value.completed)) {
    requireValue(Boolean(getOrder(id, 1) || (value.schema === 2 && getOrder(id, 2))), '未知已完成订单');
    requireValue(record(completion) && Number.isInteger(completion.stars) && completion.stars >= 1 && completion.stars <= 3, '订单星级');
    requireValue(count(completion.reward), '订单奖励');
  }
  requireValue(value.active === null || record(value.active), '进行中订单');
  if (value.active === null) return value;
  const active = value.active;
  if (value.schema === 1) {
    requireValue(!Object.hasOwn(active, 'contentVersion') || active.contentVersion === 1, '旧订单内容版本');
  } else {
    requireValue(active.contentVersion === 1 || active.contentVersion === 2, '不支持的订单内容版本');
  }
  const contentVersion = contentVersionFor(value);
  const order = activeOrderFor(value);
  requireValue(Boolean(order), '未知进行中订单');
  requireValue(value.ownedTrucks.includes(order.truckId), '订单车辆尚未拥有');
  requireValue(['loading', 'unloading', 'result'].includes(active.phase), '订单阶段');
  requireValue(count(active.stop) && active.stop < order.stops.length, '配送站次');
  requireValue(count(active.moves) && count(active.hints), '操作计数');
  requireValue(typeof active.paid === 'boolean', '结算标记');
  requireValue(record(active.placements), '装载位置');
  requireValue(Array.isArray(active.delivered) && new Set(active.delivered).size === active.delivered.length, '送达列表');
  const cargoIds = new Set(order.cargo.map(cargo => cargo.id));
  const delivered = new Set(active.delivered);
  requireValue(active.delivered.every(id => cargoIds.has(id)), '未知送达货物');
  for (const [id, placement] of Object.entries(active.placements)) {
    requireValue(cargoIds.has(id) && !delivered.has(id), '未知或已送达的装载货物');
    requireValue(record(placement) && count(placement.x) && count(placement.y)
      && Number.isInteger(placement.r) && placement.r >= 0 && placement.r <= 3, '货物位置或朝向');
    requireValue(!Object.hasOwn(placement, 'z') || placement.z === 0 || placement.z === 1, '货物层数');
    requireValue(contentVersion !== 1 || !Object.hasOwn(placement, 'z') || placement.z === 0, '旧订单不能堆叠');
  }
  // This validates a complete saved layout, rather than treating each piece as a
  // new move. Legacy content keeps its original geometry-only loading contract.
  requireValue(validateLayout(order, active.placements).ok, '货物越界、重叠、占用固定座或缺少支撑');
  if (active.phase === 'loading') {
    requireValue(active.stop === 0 && active.delivered.length === 0 && !active.paid, '装车阶段状态');
  } else {
    for (const cargo of order.cargo) {
      requireValue(delivered.has(cargo.id) || Object.hasOwn(active.placements, cargo.id), '配送阶段货物缺失');
      requireValue(cargo.stop >= active.stop || delivered.has(cargo.id), '前站货物尚未送达');
      requireValue(cargo.stop <= active.stop || !delivered.has(cargo.id), '后站货物提前送达');
    }
    if (active.phase === 'unloading') {
      requireValue(!active.paid, '卸货阶段已结算');
    } else {
      requireValue(active.paid && active.stop === order.stops.length - 1
        && active.delivered.length === order.cargo.length && Object.hasOwn(value.completed, order.id), '结算阶段状态');
    }
  }
  return value;
}

/** Validate against frozen content before adding version metadata; never write on load. */
function currentSave(value) {
  validateSave(value);
  if (value.schema === 2) return value;
  const next = clone(value);
  next.schema = 2;
  if (next.active) next.active.contentVersion = 1;
  validateSave(next);
  return next;
}

export function buyTruck(save, truckId) {
  validateSave(save);
  const truck = TRUCKS.find(item => item.id === truckId);
  if (!truck) throw fail('UNKNOWN_TRUCK', '找不到这辆货车。');
  if (save.ownedTrucks.includes(truckId)) throw fail('ALREADY_OWNED', '已拥有这辆货车。');
  if (Object.keys(save.completed).length < truck.unlockAfter) throw fail('TRUCK_LOCKED', '完成更多订单后解锁。');
  if (save.coins < truck.price) throw fail('INSUFFICIENT_COINS', '金币不足。');
  const next = clone(save);
  next.coins -= truck.price;
  next.ownedTrucks.push(truckId);
  validateSave(next);
  Object.assign(save, next);
  return save;
}

/** First completion pays once; replays can improve the recorded best stars only. */
export function settleOrder(save, stars) {
  validateSave(save);
  if (!Number.isInteger(stars) || stars < 1 || stars > 3) throw fail('INVALID_STARS', '星级必须为1至3。');
  const active = save.active;
  if (!active) throw fail('NO_ACTIVE_ORDER', '没有进行中的订单。');
  if (active.phase === 'result' && active.paid) return save;
  const order = activeOrderFor(save);
  if (active.phase !== 'unloading' || active.delivered.length !== order.cargo.length) {
    throw fail('ORDER_INCOMPLETE', '货物全部送达后才能结算。');
  }
  const next = clone(save);
  const previous = next.completed[order.id];
  if (!previous) {
    const reward = order.reward + stars * 10;
    if (!count(next.coins + reward)) throw fail('INVALID_SAVE', '金币数超过支持范围。');
    next.coins += reward;
    next.completed[order.id] = { stars, reward };
  } else {
    previous.stars = Math.max(previous.stars, stars);
  }
  next.active.phase = 'result';
  next.active.paid = true;
  validateSave(next);
  Object.assign(save, next);
  return save;
}

/** Read-only recovery: unknown or damaged content is never replaced with a fresh save. */
export function loadSave(storage) {
  let raw = null;
  try {
    if (storage === undefined) storage = globalThis.localStorage;
    raw = storage.getItem(SAVE_KEY);
    if (raw === null) return { save: freshSave(), raw, error: null };
    const save = currentSave(JSON.parse(raw));
    return { save, raw, error: null };
  } catch (error) {
    return { save: null, raw, error };
  }
}

/** Synchronous optimistic writes protect the last observed local save across tabs. */
export function createStore(storage) {
  if (storage === undefined) {
    try { storage = globalThis.localStorage; }
    catch (error) { storage = { getItem() { throw error; } }; }
  }
  let observedRaw = null;
  let recoveryRaw = null;
  let observedRevision = null;
  let loaded = false;
  let currentError = null;
  const store = {
    load() {
      const result = loadSave(storage);
      loaded = true;
      observedRaw = result.raw;
      recoveryRaw = result.raw;
      observedRevision = result.save?.revision ?? null;
      currentError = result.error;
      return result;
    },
    save(value) {
      if (!loaded) store.load();
      if (currentError) throw currentError;
      try {
        const candidate = currentSave(value);
        if (value.revision !== observedRevision) throw fail('STALE_SAVE', '存档版本已变化，请重新读取后继续。');
        if (observedRevision === Number.MAX_SAFE_INTEGER) throw fail('INVALID_SAVE', '存档版本已达到上限。');
        const next = clone(candidate);
        next.revision = observedRevision + 1;
        const nextRaw = JSON.stringify(next);
        const checkUnchanged = () => {
          const actualRaw = storage.getItem(SAVE_KEY);
          if (actualRaw !== observedRaw) {
            recoveryRaw = actualRaw;
            throw fail('SAVE_CONFLICT', '其他页面已修改存档，请重新读取后继续。');
          }
        };
        checkUnchanged();
        // Do not risk the primary save if its valid predecessor cannot be backed up.
        if (observedRaw !== null) storage.setItem(BACKUP_KEY, observedRaw);
        checkUnchanged();
        storage.setItem(SAVE_KEY, nextRaw);
        observedRaw = nextRaw;
        recoveryRaw = nextRaw;
        observedRevision = next.revision;
        return next;
      } catch (error) {
        currentError = error;
        throw error;
      }
    },
    get error() { return currentError; },
    exportRaw() { return recoveryRaw; },
  };
  return store;
}
