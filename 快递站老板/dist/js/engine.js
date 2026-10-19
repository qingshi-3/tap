import { waveSchedule } from './arrivals.js';
export { arrivalView } from './arrivals.js';
import { PIPELINE_LAYOUT, initializePipeline, enableManagement, setStaff, moveWorker, hireWorker, preserveAssignments, managementView as pipelineManagementView, pipelineParcels, beltParcels, stepPipeline, clearPipeline, validManagement } from './pipeline.js';
export { PIPELINE_LAYOUT };
export function managementView(state) { return pipelineManagementView(state, definition(state).workerSeconds); }
export { pipelineWorkerPoint } from './pipeline.js';
/** Pure, deterministic simulation. Time is seconds, belt x/progress are 0..1.
 * CONTENT.days is indexed by day-1 (freeplay uses the final definition).
 * Upgrade costs are per level; unlockDay/max are enforced in BUY.
 * Delivered means departed in a truck, never merely sorted or loaded.
 * Queues/loading contain parcels, workers own their carried parcel exclusively.
 * departures holds seconds until each truck leaves; events are presentation hints.
 * processing is the shared manual workbench job; absent schema1 fields mean idle.
 * PREPARE starts a job without moving its parcel; DISPATCH sends loaded freight.
 */
const SCHEDULES = [
  ['第一车快递', '先把普通件送到对应入口', '送达八成包裹', 12, 1.6, 0.8, ['normal']],
  ['晚班接力', '车次拉开，提前分拣减少等待', '送达八成包裹', 15, 1.5, 0.8, ['normal', 'normal']],
  ['玻璃花瓶', '花瓶先包装，再按目的地分拣', '完成包装并送达八成', 12, 1.6, 0.8, ['fragile', 'normal', 'fragile', 'normal']],
  ['花店补货', '易碎件占多数，包装台开始发挥作用', '送达八成五包裹', 11, 1.6, 0.85, ['fragile', 'fragile', 'normal']],
  ['整车集货', '车次更少，仓内需留出搬运时间', '送达八成包裹', 16, 1.8, 0.8, ['normal', 'normal', 'fragile']],
  ['街角收官', '装车加快，争取九成送达', '送达九成包裹', 10, 1.3, 0.9, ['normal', 'fragile', 'normal']],
  ['家具进站', '大件先搬运；加宽入口可直接分拣', '送达八成包裹', 13, 1.6, 0.8, ['large', 'normal', 'fragile']],
  ['搬家专场', '大件占多数，提前留出员工搬运时间', '送达八成包裹', 14, 1.8, 0.8, ['large', 'large', 'normal', 'fragile']],
  ['社区团购', '普通件集中进站，快班车连续发运', '送达八成五包裹', 9, 1.5, 0.85, ['normal', 'normal', 'normal', 'fragile', 'large']],
  ['开学急送', '急件须在 25 秒内发车，员工优先搬运', '按时送达八成包裹', 12, 1.6, 0.8, ['urgent', 'normal', 'urgent', 'fragile', 'large']],
  ['晚点班车', '发车间隔变长，加密车次可救急', '按时送达八成包裹', 16, 1.8, 0.8, ['urgent', 'urgent', 'normal', 'large', 'fragile']],
  ['社区收官', '快班车与密集急件，争取九成准时送达', '按时送达九成包裹', 9, 1.4, 0.9, ['urgent', 'normal', 'urgent', 'fragile', 'large']],
  ['缺单来件', '异常件先验单，再按标签分拣', '按时送达八成包裹', 12, 1.6, 0.8, ['exception', 'normal', 'fragile', 'large', 'urgent']],
  ['退换货潮', '异常件增多，验单机减少手工处理', '按时送达八成五包裹', 13, 1.7, 0.85, ['exception', 'exception', 'normal', 'large', 'urgent', 'fragile']],
  ['城市快线', '急件集中，班车每 9 秒离站', '按时送达九成包裹', 9, 1.4, 0.9, ['urgent', 'urgent', 'normal', 'exception', 'large', 'fragile']],
  ['家装大单', '大件集中进站，搬运比平时更慢', '按时送达八成包裹', 14, 2, 0.8, ['large', 'large', 'normal', 'exception', 'urgent', 'fragile']],
  ['周末花市', '易碎件与急件交替，先处理急件', '按时送达八成五包裹', 11, 1.6, 0.85, ['fragile', 'urgent', 'fragile', 'urgent', 'normal', 'large', 'exception']],
  ['全城通达', '五类包裹混合，快班车检验整站流程', '按时送达九成包裹', 10, 1.5, 0.9, ['normal', 'fragile', 'large', 'urgent', 'exception']],
];

export const CONTENT = {
  types: [
    { id: 'normal', name: '普通件', action: null },
    { id: 'fragile', name: '易碎件', action: '包装' },
    { id: 'large', name: '大件', action: '搬运' },
    { id: 'urgent', name: '急件', action: null },
    { id: 'exception', name: '异常件', action: '验单' },
  ],
  routes: [
    { id: 0, name: 'A 区', bonus: 2, description: 'A 区每件加付 2 元' },
    { id: 1, name: 'B 区', bonus: 2, description: 'B 区每件加付 2 元' },
    { id: 2, name: 'C 区', bonus: 2, description: 'C 区每件加付 2 元' },
  ],
  upgrades: [
    { id: 'worker', name: '增派员工', cost: [140, 260], max: 2, unlockDay: 2, description: '增加一名搬运员', effect: 'worker' },
    { id: 'packer', name: '包装台', cost: 170, max: 1, unlockDay: 2, description: '易碎件自动包装', effect: 'fragile' },
    { id: 'widegate', name: '加宽入口', cost: 350, max: 1, unlockDay: 6, description: '大件直接分拣，搬运加快', effect: 'large' },
    { id: 'dispatch', name: '加密车次', cost: 220, max: 1, unlockDay: 4, description: '发车间隔降至 7 秒', effect: 'departure' },
    { id: 'scanner', name: '验单机', cost: 420, max: 1, unlockDay: 12, description: '异常件自动验单', effect: 'exception' },
    { id: 'sorter', name: '自动分拣机', cost: 850, max: 1, unlockDay: 14, description: '普通件自动分拣，特殊件仍需指定入口', effect: 'sort' },
  ],
  days: Array.from({ length: 18 }, (_, i) => {
    const day = i + 1;
    const [name, brief, goalText, departureEvery, workerSeconds, goal, weights] = SCHEDULES[i];
    return {
      day, station: Math.floor(i / 6) + 1,
      name, stationName: ['街角驿站', '社区中转站', '城市集散站'][Math.floor(i / 6)], brief, goalText,
      total: 9 + i, duration: 95 + i * 2,
      interval: 2.4, goal, basePay: 5, departureEvery, workerSeconds: workerSeconds * 1.5, weights,
      kinds: ['normal', ...(day >= 3 ? ['fragile'] : []), ...(day >= 7 ? ['large'] : []), ...(day >= 10 ? ['urgent'] : []), ...(day >= 13 ? ['exception'] : [])],
    };
  }),
};

const PHASES = ['planning', 'running', 'summary', 'ending'];
const KINDS = CONTENT.types.map(type => type.id);
const clone = value => JSON.parse(JSON.stringify(value));
const finite = (n, min = 0, max = 1e9) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
const integer = (n, min = 0, max = 1e9) => Number.isInteger(n) && finite(n, min, max);
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const keys = (value, names) => plain(value) && Object.keys(value).every(key => names.includes(key));
const destination = n => integer(n, 0, 2);
const validOrder = order => keys(order, ['plan', 'route']) && ['steady', 'rush'].includes(order.plan) && (order.route === null || destination(order.route));
const result = (ok, message, events = []) => ({ ok, message, events });
const definition = state => CONTENT.days[Math.min(state.day, 18) - 1];
const departureInterval = state => state.upgrades.dispatch ? 7 : definition(state).departureEvery;
const preparedAutomatically = (state, kind) => (kind === 'fragile' && state.upgrades.packer) || (kind === 'exception' && state.upgrades.scanner) || (kind === 'large' && state.upgrades.widegate);

const PREPARATION_SECONDS = { fragile: 3, large: 5, exception: 4 };
/** Current purchase price, or null for an unknown/maxed tiered upgrade. */
export function upgradeCost(state, id) {
  const upgrade = CONTENT.upgrades.find(item => item.id === id);
  if (!upgrade) return null;
  return Array.isArray(upgrade.cost) ? (upgrade.cost[state.upgrades[id] || 0] ?? null) : upgrade.cost;
}
const adId = id => typeof id === 'string' && /^[A-Za-z0-9_-]{8,100}$/.test(id);
const settlement = state => ['summary', 'ending'].includes(state.phase) && state.dayResult?.day === state.day && state.history?.length === state.day && state.history.at(-1)?.day === state.day;
function validAdRewards(state) {
  if (state.adRewards === undefined) return true;
  const ads = state.adRewards;
  if (!keys(ads, ['pending', 'grants']) || !Array.isArray(ads.grants) || ads.grants.length > state.history.length) return false;
  const ids = new Set(), days = new Set();
  for (const grant of ads.grants) {
    if (!keys(grant, ['id', 'day', 'amount']) || !adId(grant.id) || !integer(grant.day, 1, state.history.length) || grant.amount !== 20 || ids.has(grant.id) || days.has(grant.day)) return false;
    ids.add(grant.id); days.add(grant.day);
  }
  const p = ads.pending;
  return p === null || (keys(p, ['id', 'day', 'amount', 'placement']) && adId(p.id) && p.day === state.day && p.amount === 20 && p.placement === 'settlement' && settlement(state) && !ids.has(p.id) && !days.has(p.day));
}
/** Eligibility is a game rule; SDK capability is checked by the adapter. */
export function adRewardAvailable(state) {
  return !!state && settlement(state) && validAdRewards(state) && !state.adRewards?.pending && !state.adRewards?.grants.some(grant => grant.day === state.day);
}
function rewardAd(state, action) {
  if (!adId(action.id)) return result(false, '广告请求无效');
  if (action.type === 'BEGIN_AD') {
    if (!adRewardAvailable(state) || state.adRewards?.grants.some(grant => grant.id === action.id)) return result(false, '今天无法领取广告奖励');
    state.adRewards ??= { pending: null, grants: [] };
    state.adRewards.pending = { id: action.id, day: state.day, amount: 20, placement: 'settlement' };
  } else {
    if (!validAdRewards(state) || state.adRewards?.pending?.id !== action.id) return result(false, '广告请求已失效');
    if (action.type === 'GRANT_AD') {
      if (!settlement(state)) return result(false, '请在当天打烊后领取');
      state.adRewards.grants.push({ id: action.id, day: state.day, amount: 20 });
      state.cash += 20;
    }
    state.adRewards.pending = null;
  }
  return result(true, action.type === 'GRANT_AD' ? '已领取20金币' : '');
}

export function createGame() {
  return { schema: 1, revision: 0, day: 1, cash: 80, reputation: 10, phase: 'planning', upgrades: {}, history: [], totalDelivered: 0, dayResult: null, contract: null, shift: null };
}

/** Exact deterministic order quantities and premiums, before any clock runs. */
export function orderPreview(state, { plan = 'steady', route = null } = {}) {
  const day = definition(state), rush = plan === 'rush';
  const total = day.total + (rush ? Math.ceil(day.total * 0.3) : 0) + Math.min(12, Math.max(0, state.day - 18));
  const waves = state.management ? waveSchedule(state.day, total, plan, day.weights) : null;
  const kinds = waves?.flatMap(w => Array(w.count).fill(w.kind));
  const routeCounts = [0, 0, 0];
  let baseRevenue = 0;
  for (let i = 0; i < total; i++) {
    const dest = route !== null && i % 3 === 0 ? route : (i * 7 + state.day - 1) % 3;
    routeCounts[dest]++;
    baseRevenue += day.basePay + ((kinds?.[i] ?? day.weights[i % day.weights.length]) === 'normal' ? 0 : 2);
  }
  const bonus = (rush ? 35 : 20) + Math.min(state.day, 50) * (rush ? 4 : 3);
  return { ...(waves ? { waves } : {}), total, goal: rush ? Math.min(1, day.goal + 0.1) : day.goal, bonus, routeCounts,
    routeExtra: route === null ? 0 : routeCounts[route] * 2, baseRevenue,
    rushExtraTotal: rush ? Math.ceil(day.total * 0.3) : 0, rushExtraBonus: rush ? 15 + Math.min(state.day, 50) : 0 };
}

function start(state, action) {
  if (state.phase !== 'planning') return result(false, '请先结束当前营业日');
  const plan = action.plan === undefined ? (state.plannedOrder?.plan ?? 'steady') : (action.plan ?? 'steady');
  const route = action.route === undefined ? (state.plannedOrder?.route ?? null) : action.route;
  if (!['steady', 'rush'].includes(plan)) return result(false, '请选择普通或加急订单');
  if (route !== null && !destination(route)) return result(false, '请选择 A、B 或 C 区');
  const day = definition(state);
  const rush = plan === 'rush';
  state.contract = { plan, route, goal: rush ? Math.min(1, day.goal + 0.1) : day.goal, bonus: (rush ? 35 : 20) + Math.min(state.day, 50) * (rush ? 4 : 3) };
  const total = day.total + (rush ? Math.ceil(day.total * 0.3) : 0) + Math.min(12, Math.max(0, state.day - 18));
  state.shift = {
    elapsed: 0, duration: day.duration, processing: null, spawned: 0, total, parcels: [], queues: [[], [], []], loading: [[], [], []],
    delivered: 0, errors: 0, missed: 0, earnings: 0, specialHandled: 0, nextId: 1,
    workers: Array.from({ length: 1 + (state.upgrades.worker || 0) }, (_, i) => ({ id: i + 1, dest: i % 3, parcel: null, progress: 0 })),
    departures: [departureInterval(state), departureInterval(state) + 1, departureInterval(state) + 2], routeDelivered: [0, 0, 0], urgentDelivered: 0, timedOut: false,
  };
  if (state.management) {
    initializePipeline(state);
    state.shift.flow.rules = 2;
    state.shift.arrivals = { version: 1, waves: waveSchedule(state.day, total, plan, day.weights), cursor: 0, waiting: [] };
  }
  state.dayResult = null;
  state.phase = 'running';
  delete state.plannedOrder;
  // The first parcel is immediately actionable; the clock never runs in planning.
  if (state.shift.arrivals) inbound(state); else spawn(state);
  return result(true, '开始营业', [{ type: 'start', day: state.day }]);
}

function spawn(state) {
  const shift = state.shift;
  const day = definition(state);
  const index = shift.spawned;
  // A new day's special kind arrives first, then repeats predictably.
  const kind = day.weights[index % day.weights.length];
  const dest = state.contract.route !== null && index % 3 === 0 ? state.contract.route : (index * 7 + state.day - 1) % 3;
  shift.parcels.push({ id: shift.nextId++, dest, kind, x: 0.04, prepared: !!preparedAutomatically(state, kind), age: 0 });
  shift.spawned++;
}

function inbound(state) {
  const s=state.shift, a=s.arrivals;
  while(a.cursor<a.waves.length && a.waves[a.cursor].at<=s.elapsed+1e-8) {
    const wave=a.waves[a.cursor++];
    for(let i=0;i<wave.count;i++) {
      const index=s.spawned++;
      const dest=state.contract.route!==null && index%3===0 ? state.contract.route : (index*7+state.day-1)%3;
      a.waiting.push({id:s.nextId++,dest,kind:wave.kind,x:0.04,prepared:!!preparedAutomatically(state,wave.kind),age:Math.max(0,s.elapsed-wave.at)});
    }
  }
  if(a.waiting.length && beltHasRoom(s)) s.parcels.push(a.waiting.shift());
}

function beltHasRoom(shift) {
  return beltParcels(shift).every(parcel => parcel.x >= 0.24 - 1e-8);
}

function sort(state, action) {
  if (state.management) return result(false, '分拣由岗位员工自动完成');
  if (state.phase !== 'running') return result(false, '营业中才能分拣');
  if (!destination(action.dest)) return result(false, '请选择 A、B 或 C 区入口');
  const index = state.shift.parcels.findIndex(parcel => parcel.id === action.id);
  if (index < 0) return result(false, '这个包裹已处理');
  const parcel = state.shift.parcels[index];
  if (parcel.dest !== action.dest) {
    state.shift.errors++;
    return result(false, `目的地是 ${'ABC'[parcel.dest]} 区，包裹仍在传送带`, [{ type: 'wrong', id: parcel.id }]);
  }
  if (['fragile', 'large', 'exception'].includes(parcel.kind) && !parcel.prepared) {
    const verb = CONTENT.types.find(type => type.id === parcel.kind).action;
    return result(false, `请先${verb}，再放入 ${'ABC'[parcel.dest]} 区`);
  }
  state.shift.parcels.splice(index, 1);
  state.shift.queues[action.dest].push(parcel);
  return result(true, '已进入分拣口', [{ type: 'sorted', id: parcel.id, dest: parcel.dest }]);
}

function prepare(state, action) {
  if (state.management) return result(false, '包装由岗位员工自动完成');
  if (state.phase !== 'running') return result(false, '营业中才能处理包裹');
  const parcel = state.shift.parcels.find(item => item.id === action.id);
  if (!parcel) return result(false, '这个包裹已处理');
  if (!['fragile', 'large', 'exception'].includes(parcel.kind)) return result(false, '这个包裹可以直接分拣');
  if (parcel.prepared) return result(false, '已经处理好，可以分拣');
  if (state.shift.processing) return result(false, '工作台正在处理包裹');
  const duration = PREPARATION_SECONDS[parcel.kind];
  state.shift.processing = { id: parcel.id, remaining: duration, duration };
  return result(true, '开始处理', [{ type: 'startedProcessing', id: parcel.id }]);
}

function buy(state, action) {
  if (state.phase !== 'planning') return result(false, '请在开门前购买设备');
  const upgrade = CONTENT.upgrades.find(item => item.id === action.id);
  if (!upgrade) return result(false, '没有这项设备');
  if (state.day < upgrade.unlockDay) return result(false, `第 ${upgrade.unlockDay} 天开放`);
  if ((state.upgrades[upgrade.id] || 0) >= upgrade.max) return result(false, '设备已升满');
  const cost = upgradeCost(state, upgrade.id);
  if (state.cash < cost) return result(false, `还差 ${cost - state.cash} 元，先营业赚取运费`);
  state.cash -= cost;
  state.upgrades[upgrade.id] = (state.upgrades[upgrade.id] || 0) + 1;
  if (state.management && upgrade.id === 'worker') hireWorker(state);
  return result(true, `${upgrade.name}已到位`, [{ type: 'upgrade', id: upgrade.id }]);
}

export function dispatch(state, action) {
  if (!plain(action)) return result(false, '操作无效');
  let outcome;
  switch (action.type) {
    case 'ENABLE_MANAGEMENT': {
      const checked = validate(state);
      if (!checked.ok) return result(false, checked.message);
      if (!enableManagement(state, definition(state).workerSeconds)) return result(false, '岗位管理已开启');
      outcome = result(true, '岗位管理已开启');
      break;
    }
    case 'MOVE_WORKER':
      if (!moveWorker(state, action.workerId, action.role)) return result(false, '请选择有效员工和岗位');
      outcome = result(true, '员工岗位已更新');
      break;
    case 'SET_STAFF':
      if (!setStaff(state, action.staff)) return result(false, '岗位人数须合计为全部员工');
      outcome = result(true, '岗位分配已更新');
      break;
    case 'SET_ORDER':
      if (state.phase !== 'planning') return result(false, '请在开门前接单');
      if (!validOrder({ plan: action.plan, route: action.route })) return result(false, '请选择有效订单和线路');
      state.plannedOrder = { plan: action.plan, route: action.route };
      outcome = result(true, '订单已接，准备好后开门');
      break;
    case 'START': outcome = start(state, action); break;
    case 'SORT': outcome = sort(state, action); break;
    case 'PREPARE': outcome = prepare(state, action); break;
    case 'DISPATCH': {
      if (state.phase !== 'running' || !destination(action.dest)) return result(false, '请选择营业中的线路');
      if (!state.shift.loading[action.dest].length) return result(false, '车上还没有包裹');
      const events = [];
      depart(state, action.dest, events);
      state.shift.departures[action.dest] = departureInterval(state);
      outcome = result(true, '车辆已发出', events);
      break;
    }
    case 'BUY': outcome = buy(state, action); break;
    case 'BEGIN_AD': case 'GRANT_AD': case 'CANCEL_AD': outcome = rewardAd(state, action); break;
    case 'NEXT':
      if (!['summary', 'ending'].includes(state.phase)) return result(false, '请先完成当天营业');
      if (state.adRewards) state.adRewards.pending = null;
      preserveAssignments(state);
      state.day++;
      state.phase = 'planning';
      state.shift = null;
      state.contract = null;
      delete state.plannedOrder;
      state.dayResult = null;
      outcome = result(true, state.day > 18 ? '自由营业' : '准备下一天');
      break;
    default: return result(false, '操作无效');
  }
  // Wrong destinations count as errors even though the action is rejected.
  if (outcome.ok || outcome.events.some(event => event.type === 'wrong')) state.revision++;
  return outcome;
}

function depart(state, dest, events) {
  const shift = state.shift;
  const parcels = shift.loading[dest].splice(0);
  if (!parcels.length) return;
  let pay = 0;
  for (const parcel of parcels) {
    const urgentOnTime = parcel.kind !== 'urgent' || parcel.age <= 25;
    // Late urgent parcels still arrive but lose their premium and contract credit.
    pay += definition(state).basePay + (parcel.kind === 'normal' ? 0 : 2) + (parcel.kind === 'urgent' && urgentOnTime ? 5 : 0) + (state.contract.route === dest ? 2 : 0);
    shift.delivered++;
    shift.routeDelivered[dest]++;
    if (parcel.kind !== 'normal') shift.specialHandled++;
    if (parcel.kind === 'urgent') {
      if (urgentOnTime) shift.urgentDelivered++;
      else shift.missed++;
    }
  }
  const batchBonus = parcels.length >= 3 ? parcels.length : 0;
  pay += batchBonus;
  shift.earnings += pay;
  events.push({ type: 'depart', dest, count: parcels.length, earnings: pay, batchBonus });
}

function settle(state, events) {
  if (state.phase !== 'running' || state.dayResult) return;
  const shift = state.shift;
  shift.processing = null;
  const onTime = shift.delivered - Math.max(0, shift.missed - (shift.total - shift.delivered));
  const success = onTime >= Math.ceil(shift.total * state.contract.goal) && shift.errors <= Math.max(2, Math.floor(shift.total / 6));
  const bonus = success ? state.contract.bonus : 0;
  // A small attendance fee guarantees manual-only recovery after a difficult day.
  const profit = shift.earnings + bonus + 20;
  state.cash += profit;
  state.totalDelivered += shift.delivered;
  state.reputation = Math.max(0, Math.min(100, state.reputation + (success ? 3 : -1)));
  state.dayResult = { day: state.day, delivered: shift.delivered, errors: shift.errors, missed: shift.missed, earnings: shift.earnings, bonus, profit, success, station: definition(state).station, plan: state.contract.plan, route: state.contract.route };
  state.history.push(clone(state.dayResult));
  state.phase = state.day === 18 ? 'ending' : 'summary';
  events.push({ type: 'settled', ...state.dayResult });
}

function step(state, dt, events) {
  const shift = state.shift;
  shift.elapsed = Math.min(shift.duration, shift.elapsed + dt);
  const interval = definition(state).interval * (state.contract.plan === 'rush' ? 0.75 : 1);
  // A blocked belt stops the inbound hopper. Unreleased parcels remain in the
  // day's total and are accounted for at closing, never stacked invisibly.
  if (!shift.arrivals) while (shift.spawned < shift.total && (shift.parcels.length === 0 || shift.elapsed + 1e-8 >= shift.spawned * interval) && beltHasRoom(shift)) spawn(state);
  const allParcels = [...(shift.arrivals?.waiting || []), ...pipelineParcels(shift), ...shift.parcels, ...shift.queues.flat(), ...shift.loading.flat(), ...shift.workers.map(worker => worker.parcel).filter(Boolean)];
  for (const parcel of allParcels) parcel.age += dt;
  if (shift.arrivals) inbound(state);
  if (shift.processing) {
    shift.processing.remaining = Math.max(0, shift.processing.remaining - dt);
    if (shift.processing.remaining <= 1e-8) {
      const parcel = shift.parcels.find(item => item.id === shift.processing.id);
      parcel.prepared = true;
      events.push({ type: 'prepared', id: parcel.id });
      shift.processing = null;
    }
  }
  if (state.management) {
    stepPipeline(state, dt, definition(state).workerSeconds, events);
    finishStep(state, dt, events);
    return;
  }
  let ahead = 1.16;
  for (const parcel of [...shift.parcels].sort((a, b) => a.id - b.id)) {
    parcel.x = Math.min(0.96, ahead - 0.2, parcel.x + dt / 8);
    if (preparedAutomatically(state, parcel.kind)) parcel.prepared = true;
    if (state.upgrades.sorter && parcel.x >= 0.6 && parcel.kind === 'normal') {
      sort(state, { id: parcel.id, dest: parcel.dest });
      events.push({ type: 'autoSorted', id: parcel.id, dest: parcel.dest });
    } else ahead = parcel.x;
  }
  for (const worker of shift.workers) {
    if (worker.parcel) {
      const base = definition(state).workerSeconds;
      const seconds = worker.parcel.kind === 'large' && !state.upgrades.widegate ? base * 2.125 : base;
      worker.progress = Math.min(1, worker.progress + dt / seconds);
      if (worker.progress >= 1) {
        shift.loading[worker.dest].push(worker.parcel);
        events.push({ type: 'loaded', id: worker.parcel.id, dest: worker.dest });
        worker.parcel = null;
        worker.progress = 0;
      }
    }
    if (!worker.parcel) {
      // Oldest urgent parcel wins across lanes, then oldest ordinary parcel.
      const candidates = shift.queues.flat().sort((a, b) => Number(b.kind === 'urgent') - Number(a.kind === 'urgent') || b.age - a.age || a.id - b.id);
      if (candidates.length) {
        const parcel = candidates[0];
        shift.queues[parcel.dest].splice(shift.queues[parcel.dest].findIndex(item => item.id === parcel.id), 1);
        worker.dest = parcel.dest;
        worker.parcel = parcel;
      }
    }
  }
  finishStep(state, dt, events);
}

function finishStep(state, dt, events) {
  const shift = state.shift;
  for (let dest = 0; dest < 3; dest++) {
    shift.departures[dest] -= dt;
    if (shift.departures[dest] <= 1e-8) {
      depart(state, dest, events);
      shift.departures[dest] += departureInterval(state);
    }
  }
  const remaining = (shift.arrivals?.waiting.length || 0) + pipelineParcels(shift).length + shift.parcels.length + shift.queues.flat().length + shift.loading.flat().length + shift.workers.filter(worker => worker.parcel).length;
  if (shift.elapsed + 1e-8 >= shift.duration) {
    // Closing time catches every unresolved parcel, including unspawned backlog.
    shift.timedOut = true;
    shift.missed += remaining + shift.total - shift.spawned;
    clearPipeline(shift);
    if (shift.arrivals) shift.arrivals.waiting.length = 0;
    shift.parcels.length = 0;
    shift.queues.forEach(queue => queue.length = 0);
    shift.loading.forEach(queue => queue.length = 0);
    shift.workers.forEach(worker => { worker.parcel = null; worker.progress = 0; });
    settle(state, events);
  } else if (shift.spawned === shift.total && remaining === 0) settle(state, events);
}

export function tick(state, seconds) {
  const events = [];
  if (state.phase !== 'running' || !finite(seconds, 0, 86400) || seconds === 0) return events;
  let left = Math.min(seconds, state.shift.duration - state.shift.elapsed);
  while (left > 1e-8 && state.phase === 'running') {
    const dt = Math.min(0.1, left);
    step(state, dt, events);
    left -= dt;
  }
  state.revision++;
  return events;
}

/** Strict whole-document validation. Unknown or future fields are rejected,
 * rather than guessed or silently reset. Returns {ok,message}. */
export function validate(state) {
  const bad = message => ({ ok: false, message });
  if (!keys(state, ['schema', 'revision', 'day', 'cash', 'reputation', 'phase', 'upgrades', 'history', 'totalDelivered', 'dayResult', 'contract', 'shift', 'adRewards', 'management', 'plannedOrder'])) return bad('存档结构不受支持');
  if (state.schema !== 1) return bad('存档版本不受支持，原件已保留');
  if (!integer(state.revision) || !integer(state.day, 1, 100000) || !integer(state.cash) || !integer(state.reputation, 0, 100) || !integer(state.totalDelivered) || !PHASES.includes(state.phase)) return bad('存档基础数据损坏');
  if (!keys(state.upgrades, CONTENT.upgrades.map(item => item.id)) || !CONTENT.upgrades.every(upgrade => state.upgrades[upgrade.id] === undefined || integer(state.upgrades[upgrade.id], 0, upgrade.max))) return bad('设备数据损坏');
  const validResult = item => keys(item, ['day', 'delivered', 'errors', 'missed', 'earnings', 'bonus', 'profit', 'success', 'station', 'plan', 'route']) && integer(item.day, 1, 100000) && ['delivered', 'errors', 'missed', 'earnings', 'bonus', 'profit'].every(key => integer(item[key])) && typeof item.success === 'boolean' && integer(item.station, 1, 3) && ['steady', 'rush'].includes(item.plan) && (item.route === null || destination(item.route)) && item.profit === item.earnings + item.bonus + 20;
  if (!Array.isArray(state.history) || state.history.length > 100000 || !state.history.every((item, index) => validResult(item) && item.day === index + 1)) return bad('营业记录损坏');
  const settled = ['summary', 'ending'].includes(state.phase);
  if (state.history.length !== state.day - (settled ? 0 : 1) || state.history.reduce((sum, item) => sum + item.delivered, 0) !== state.totalDelivered) return bad('营业进度不一致');
  if (settled ? (!validResult(state.dayResult) || Object.keys(state.dayResult).some(key => state.dayResult[key] !== state.history.at(-1)?.[key])) : state.dayResult !== null) return bad('结算数据不一致');
  if ((state.phase === 'ending') !== (settled && state.day === 18)) return bad('营业阶段不一致');
  if (!validManagement(state, definition(state).workerSeconds)) return bad('岗位管理数据损坏');
  if (!validAdRewards(state)) return bad('广告奖励记录损坏');
  // Older schema1 documents omit this preparation-only order draft.
  if (Object.hasOwn(state, 'plannedOrder') && (state.phase !== 'planning' || !validOrder(state.plannedOrder))) return bad('待开门订单损坏');
  if (state.phase === 'planning') return state.shift === null && state.contract === null ? { ok: true, message: '' } : bad('准备阶段数据不一致');
  const contract = state.contract;
  if (!keys(contract, ['plan', 'route', 'goal', 'bonus']) || !['steady', 'rush'].includes(contract.plan) || !(contract.route === null || destination(contract.route)) || contract.goal !== (contract.plan === 'rush' ? Math.min(1, definition(state).goal + 0.1) : definition(state).goal) || contract.bonus !== (contract.plan === 'rush' ? 35 : 20) + Math.min(state.day, 50) * (contract.plan === 'rush' ? 4 : 3)) return bad('订单数据损坏');
  const shift = state.shift;
  if (!keys(shift, ['elapsed', 'duration', 'spawned', 'total', 'parcels', 'queues', 'loading', 'delivered', 'errors', 'missed', 'earnings', 'specialHandled', 'nextId', 'workers', 'departures', 'routeDelivered', 'urgentDelivered', 'timedOut', 'processing', 'flow', 'arrivals'])) return bad('营业数据结构损坏');
  if (!finite(shift.duration, 1, 1000) || !finite(shift.elapsed, 0, shift.duration) || !integer(shift.total, 1, 1000) || !integer(shift.spawned, 0, shift.total) || !integer(shift.nextId, 1, 1001) || shift.nextId !== shift.spawned + 1 || !['delivered', 'errors', 'missed', 'earnings', 'specialHandled', 'urgentDelivered'].every(key => integer(shift[key])) || typeof shift.timedOut !== 'boolean') return bad('营业计数损坏');
  if (state.phase === 'running' && (shift.elapsed >= shift.duration || shift.timedOut)) return bad('营业时钟与阶段不一致');
  if (shift.delivered > shift.spawned || shift.specialHandled > shift.delivered || shift.urgentDelivered > shift.specialHandled || shift.missed > shift.total || (shift.timedOut && !settled)) return bad('送达计数不一致');
  if (!shift.timedOut && shift.missed > shift.delivered) return bad('迟到计数不一致');
  if (!Array.isArray(shift.parcels) || !Array.isArray(shift.queues) || shift.queues.length !== 3 || !shift.queues.every(Array.isArray) || !Array.isArray(shift.loading) || shift.loading.length !== 3 || !shift.loading.every(Array.isArray)) return bad('分拣队列损坏');
  if (!Array.isArray(shift.workers) || shift.workers.length !== 1 + (state.upgrades.worker || 0) || !shift.workers.every((worker, index) => keys(worker, ['id', 'dest', 'parcel', 'progress']) && worker.id === index + 1 && destination(worker.dest) && finite(worker.progress, 0, 1) && (worker.parcel === null || plain(worker.parcel)))) return bad('员工数据损坏');
  if (!Array.isArray(shift.departures) || shift.departures.length !== 3 || !shift.departures.every(value => finite(value, 0, 18)) || !Array.isArray(shift.routeDelivered) || shift.routeDelivered.length !== 3 || !shift.routeDelivered.every(value => integer(value)) || shift.routeDelivered.reduce((sum, value) => sum + value, 0) !== shift.delivered) return bad('车次数据损坏');
  if (shift.arrivals !== undefined) {
    const a=shift.arrivals, expected=waveSchedule(state.day,shift.total,state.contract.plan,definition(state).weights);
    if (shift.flow?.rules!==2 || !keys(a,['version','waves','cursor','waiting']) || a.version!==1 || !Array.isArray(a.waiting) || !integer(a.cursor,0,expected.length) || (!Array.isArray(a.waves) || a.waves.length!==expected.length || !a.waves.every((w,i)=>keys(w,['kind','count','at']) && w.kind===expected[i].kind && w.count===expected[i].count && w.at===expected[i].at)) || shift.spawned!==expected.slice(0,a.cursor).reduce((n,w)=>n+w.count,0) || expected.slice(0,a.cursor).some(w=>w.at>shift.elapsed+1e-8) || (expected[a.cursor] && expected[a.cursor].at<=shift.elapsed+1e-8)) return bad('来件批次损坏');
  } else if (shift.flow?.rules !== undefined) return bad('缺少来件批次');
  const parcels = [...(shift.arrivals?.waiting || []), ...pipelineParcels(shift), ...shift.parcels, ...shift.queues.flat(), ...shift.loading.flat(), ...shift.workers.map(worker => worker.parcel).filter(Boolean)];
  if (!parcels.every(parcel => keys(parcel, ['id', 'dest', 'kind', 'x', 'prepared', 'age']) && integer(parcel.id, 1, shift.spawned) && destination(parcel.dest) && KINDS.includes(parcel.kind) && finite(parcel.x, 0, 1) && typeof parcel.prepared === 'boolean' && finite(parcel.age, 0, 2000))) return bad('包裹数据损坏');
  if (shift.arrivals) {
    const manifest=shift.arrivals.waves.flatMap(w=>Array(w.count).fill(w));
    if (parcels.some(p=>p.kind!==manifest[p.id-1].kind || p.dest!==(state.contract.route!==null && (p.id-1)%3===0 ? state.contract.route : ((p.id-1)*7+state.day-1)%3) || Math.abs(p.age-(shift.elapsed-manifest[p.id-1].at))>1e-6) || shift.arrivals.waiting.some(p=>p.x!==0.04)) return bad('来件归属或到站时间损坏');
  }
  if (new Set(parcels.map(parcel => parcel.id)).size !== parcels.length || parcels.length + shift.delivered + (shift.timedOut ? shift.total - shift.delivered : 0) !== (shift.timedOut ? shift.total : shift.spawned)) return bad('包裹归属不一致');
  if (shift.processing !== undefined && shift.processing !== null) {
    const job = shift.processing;
    const parcel = shift.parcels.find(item => item.id === job.id);
    if (!keys(job, ['id', 'remaining', 'duration']) || !integer(job.id, 1, shift.spawned) || !parcel || parcel.prepared || !PREPARATION_SECONDS[parcel.kind] || job.duration !== PREPARATION_SECONDS[parcel.kind] || !finite(job.remaining, Number.MIN_VALUE, job.duration) || settled) return bad('工作台数据损坏');
  }
  const belt = beltParcels(shift).sort((a, b) => a.id - b.id);
  if (belt.length > 5 || belt.some((parcel, index) => index > 0 && belt[index - 1].x - parcel.x < 0.2 - 1e-8)) return bad('传送带间距损坏');
  if (shift.queues.some((queue, dest) => queue.some(parcel => parcel.dest !== dest)) || shift.loading.some((queue, dest) => queue.some(parcel => parcel.dest !== dest)) || shift.workers.some(worker => worker.parcel && worker.parcel.dest !== worker.dest)) return bad('包裹目的地不一致');
  if (settled && (parcels.length || ['delivered', 'errors', 'missed', 'earnings'].some(key => state.dayResult[key] !== shift[key]) || state.dayResult.bonus !== (state.dayResult.success ? contract.bonus : 0))) return bad('结算状态损坏');
  return { ok: true, message: '' };
}
