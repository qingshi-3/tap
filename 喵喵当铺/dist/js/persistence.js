// Fixed save location and explicit, recoverable migration. UI replaces live state only after commit.
import { ITEMS, MACHINES, WG } from './data.js';
import { ensureGrowthState } from './business.js';
export const RUN_KEY = 'mmdp_run', META_KEY = 'mmdp_meta', SAVE_VERSION = 3;
export class PersistenceError extends Error { constructor(message, code = 'SAVE_FAILED') { super(message); this.name = 'PersistenceError'; this.code = code; } }
const clone = value => JSON.parse(JSON.stringify(value));
export function rebindRun(s) {
  const items = [...s.shelf, ...s.hidden, ...(s.business?.warehouse || s.warehouse?.items || [])];
  for (const c of s.queue) if (c.kind === 'buy' && c.item) c.item = items.find(it => it.uid === c.item.uid) || c.item;
  return s;
}
const fail = message => { throw new PersistenceError(message, 'INVALID_SAVE'); };
function validateNetwork(n, day, ownership) {
  const obj = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const nat = value => Number.isSafeInteger(value) && value >= 0;
  const cash = value => Number.isFinite(value) && value >= 0;
  const same = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.000001;
  const policy = p => obj(p) && typeof p.enabled === 'boolean' && ['water', 'balanced', 'fish'].includes(p.production) && ['standard', 'mixed', 'premium'].includes(p.quality) && ['harbor', 'boutique'].includes(p.priority) && nat(p.reserve);
  const qty = q => obj(q) && ['standard', 'premium', 'fish'].every(k => nat(q[k]));
  const period = p => obj(p) && nat(p.id) && p.id > 0 && p.start === (p.id - 1) * 5 + 1 && p.end === p.start + 4;
  if (!obj(n) || n.v !== 1 || !obj(n.builds) || !policy(n.policy) || !Array.isArray(n.history) || n.history.length > 2 || !nat(n.streak) || n.completedDay !== null && (!nat(n.completedDay) || n.completedDay < 1 || n.completedDay > day) || typeof n.goalReason !== 'string' || !obj(n.marks) || !nat(n.marks.opened) || !nat(n.marks.settled) || !obj(n.legacyMargins)) fail('区域经营存档损坏或版本不支持');
  if (n.reception !== undefined && !['all', 'stock'].includes(n.reception)) fail('区域接待安排损坏');
  if (!obj(n.profitable) || ['workshop', 'harbor', 'boutique'].some(id => typeof n.profitable[id] !== 'boolean' || n.profitable[id] && !n.builds[id])) fail('区域盈利资格损坏');
  const nowPeriod = Math.floor((day - 1) / 5) + 1;
  if (n.marks.opened > nowPeriod || n.marks.settled > nowPeriod || n.marks.settled > n.marks.opened) fail('区域结算期次损坏');
  for (const [key, amount] of Object.entries(n.legacyMargins)) if (!/^[1-9]\d*$/.test(key) || Number(key) > nowPeriod || !Number.isFinite(amount)) fail('老店周期毛利损坏');
  for (const id of ['workshop', 'harbor', 'boutique', 'capacity']) {
    const b = n.builds[id];
    if (b !== null && (!obj(b) || !cash(b.cost) || b.cost === 0 || !nat(b.builtDay) || b.builtDay < 1 || b.builtDay > day || !nat(b.effectiveDay) || b.effectiveDay <= b.builtDay || (b.effectiveDay - 1) % 5 !== 0)) fail('区域建设记录损坏');
    if (b !== null && !ownership.owned) fail('区域建设缺少店铺产权');
  }
  if ((n.builds.harbor || n.builds.boutique || n.builds.capacity) && !n.builds.workshop || n.builds.capacity && !n.builds.harbor && !n.builds.boutique) fail('区域建设依赖丢失');
  if (n.completedDay !== null && ['workshop', 'harbor', 'boutique'].some(id => !n.builds[id] || n.builds[id].effectiveDay > n.completedDay)) fail('区域目标记录与生效建设不符');
  const plan = p => {
    if (!obj(p) || !period(p.period) || !obj(p.market) || !['normal', 'harbor', 'boutique', 'fish'].includes(p.market.id) || typeof p.market.name !== 'string' || ![48, 72].includes(p.capacity) || !nat(p.hoursUsed) || p.hoursUsed > p.capacity || !qty(p.production) || !qty(p.waste) || !Array.isArray(p.stores) || !p.stores.length || !cash(p.income) || !cash(p.materials) || !cash(p.wages) || !cash(p.spending) || !Number.isFinite(p.profit) || !cash(p.requiredCash) || !nat(p.reserve) || typeof p.affordable !== 'boolean' || !cash(p.shortfall) || !same(p.profit, p.income - p.spending)) fail('区域批量计划损坏');
    if (p.hoursUsed !== p.production.standard + p.production.premium * 2 + p.production.fish * 2 || !same(p.materials, p.production.standard * 11 + p.production.premium * 17 + p.production.fish * 12) || !same(p.spending, p.materials + p.wages)) fail('区域产能或批次成本损坏');
    if (p.market.id !== ['normal', 'harbor', 'boutique', 'fish'][(p.period.id - 1) % 4] || p.affordable !== true || p.shortfall !== 0) fail('区域行情或已付款批次状态损坏');
    const ids = new Set();
    for (const shop of p.stores) {
      if (!obj(shop) || !['old', 'harbor', 'boutique'].includes(shop.id) || ids.has(shop.id) || typeof shop.name !== 'string' || !obj(shop.demand) || !nat(shop.demand.water) || !nat(shop.demand.fish) || !qty(shop.units) || !cash(shop.income) || !cash(shop.materials) || !cash(shop.wages) || !cash(shop.wasteCost) || !cash(shop.spending) || !Number.isFinite(shop.profit) || !same(shop.profit, shop.income - shop.spending) || shop.units.standard + shop.units.premium > shop.demand.water || shop.units.fish > shop.demand.fish) fail('分店经营记录损坏');
      ids.add(shop.id);
      const retailWater = shop.id === 'boutique' ? 70 : 44, retailFish = 56;
      if (shop.id === 'boutique' && shop.units.standard !== 0 || !same(shop.income, (shop.units.standard + shop.units.premium) * retailWater + shop.units.fish * retailFish) || !same(shop.materials, shop.units.standard * 11 + shop.units.premium * 17 + shop.units.fish * 12) || !same(shop.spending, shop.materials + shop.wages + shop.wasteCost)) fail('分店品质、收入或成本损坏');
    }
    if (!ids.has('old') || !same(p.wages, 120 + (ids.has('harbor') ? 90 : 0) + (ids.has('boutique') ? 120 : 0)) || p.requiredCash < p.spending + p.reserve) fail('区域工资或周转保护损坏');
    for (const k of ['standard', 'premium', 'fish']) if (p.stores.reduce((sum, shop) => sum + shop.units[k], 0) + p.waste[k] !== p.production[k]) fail('区域货物分配数量损坏');
    for (const k of ['income', 'spending', 'profit']) if (!same(p.stores.reduce((sum, shop) => sum + shop[k], 0), p[k])) fail('区域经营分摊损坏');
    if (!same(p.stores.reduce((sum, shop) => sum + shop.materials + shop.wasteCost, 0), p.materials) || !same(p.stores.reduce((sum, shop) => sum + shop.wages, 0), p.wages)) fail('区域材料与工资分摊损坏');
  };
  if (n.current !== null) {
    const c = n.current;
    if (!obj(c) || !nat(c.period) || c.period < 1 || c.id !== `network:${c.period}` || c.start !== (c.period - 1) * 5 + 1 || c.end !== c.start + 4 || !policy(c.policy) || !obj(c.costs) || !cash(c.costs.materials) || !cash(c.costs.wages) || !same(c.costs.total, c.costs.materials + c.costs.wages)) fail('区域在制批次损坏');
    plan(c.plan);
    if (c.plan.period.id !== c.period || !same(c.costs.materials, c.plan.materials) || !same(c.costs.wages, c.plan.wages) || !same(c.costs.total, c.plan.spending)) fail('区域在制扣款快照损坏');
    if (c.start > day || c.end < day || n.marks.opened !== c.period || n.marks.settled >= c.period) fail('区域在制批次期次损坏');
  }
  const ids = new Set();
  for (const r of n.history) {
    plan(r);
    if (r.id !== `network:${r.period.id}` || ids.has(r.id) || !nat(r.settledDay) || r.settledDay < r.period.end || r.settledDay > day || typeof r.goalQualified !== 'boolean' || typeof r.goalReason !== 'string' || !Number.isFinite(r.legacyProfit) || !same(r.oldStoreProfit, (r.stores.find(shop => shop.id === 'old')?.profit || 0) + r.legacyProfit)) fail('区域结算报告损坏');
    ids.add(r.id);
    if (r.period.id > n.marks.settled) fail('区域历史结算标记丢失');
  }
  if (n.streak > 0 && !n.history.at(-1)?.goalQualified || n.streak >= 3 && n.completedDay === null) fail('区域连续目标标记损坏');
  if (n.streak >= 2 && (n.history.length < 2 || !n.history[0].goalQualified || n.history[0].period.id + 1 !== n.history[1].period.id)) fail('区域连续周期证据损坏');
  if (n.streak > 0) {
    const opened = ['workshop', 'harbor', 'boutique'].map(id => n.builds[id]?.effectiveDay);
    if (opened.some(value => !Number.isInteger(value)) || n.streak > n.marks.settled - Math.floor((Math.max(...opened) - 1) / 5)) fail('区域目标期数超出生效范围');
  }
  if (n.completedDay !== null && n.completedDay < Math.max(...['workshop', 'harbor', 'boutique'].map(id => n.builds[id].effectiveDay)) + 14) fail('区域目标早于三个完整周期');
}
export const createRunId = () => globalThis.crypto?.randomUUID?.() || `run-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function validateRun(s) {
  if (!s || ![2, 3].includes(s.v)) fail('不支持此存档版本，原存档已保留');
  if (!Number.isInteger(s.day) || s.day < 1 || !Number.isFinite(s.money) || s.money < 0 || !Number.isInteger(s.uid) || s.uid < 1) fail('存档日期、余额或物品编号损坏');
  for (const key of ['shelf', 'hidden', 'orders', 'queue', 'win']) if (!Array.isArray(s[key])) fail(`存档缺少 ${key}`);
  for (const key of ['machines', 'owned', 'up', 'rep', 'st', 'story', 'night', 'mkt']) if (!s[key] || typeof s[key] !== 'object' || Array.isArray(s[key])) fail(`存档缺少 ${key}`);
  const nat = n => Number.isSafeInteger(n) && n >= 0;
  const obj = value => !!value && typeof value === 'object' && !Array.isArray(value);
  if (s.v === 3 && (!obj(s.business) || !Array.isArray(s.business.warehouse))) fail('经营存档结构损坏');
  if (!nat(s.shelfCap) || !nat(s.hiddenCap) || s.shelf.length > s.shelfCap || s.hidden.length > s.hiddenCap || !nat(s.filter) || !Number.isFinite(s.rentDue) || s.rentDue < 0) fail('库存容量、滤芯或欠租损坏');
  if (!['day', 'night', ...(s.v === 3 ? ['dawn'] : [])].includes(s.phase) || !Number.isInteger(s.qi) || s.qi < 0 || s.qi > s.queue.length) fail('营业流程存档损坏');
  const seen = new Set();
  const item = it => {
    if (!it || !ITEMS[it.id] || !Number.isInteger(it.uid) || it.uid < 1 || seen.has(it.uid) || it.uid >= s.uid || !Number.isFinite(it.cost) || it.cost < 0 || !Number.isFinite(it.q) || it.q <= 0 || typeof it.fake !== 'boolean' || typeof it.stolen !== 'boolean') fail('物品记录损坏或编号重复');
    if (it.id === 'water' && (!nat(it.g) || !WG[it.g] || it.lab != null && (!nat(it.lab) || !WG[it.lab]))) fail('水质记录损坏');
    seen.add(it.uid);
  };
  [...s.shelf, ...s.hidden, ...(s.business?.warehouse || s.warehouse?.items || [])].forEach(item);
  for (const [mid, job] of Object.entries(s.machines)) {
    if (!MACHINES[mid]) fail('未知机器记录');
    if (!job) continue;
    if (!obj(job) || !nat(job.left) || !nat(job.n) || job.n === 0 || job.left > MACHINES[mid].days || job.ready && job.left !== 0 || !job.ready && job.left === 0) fail('生产进度损坏');
    if (job.items !== undefined && (!Array.isArray(job.items) || !job.products && job.items.length !== job.n)) fail('生产原料记录损坏');
    if (job.products !== undefined) {
      if (!job.ready || !Array.isArray(job.products) || job.products.length !== job.n || job.products.some(it => it.id !== MACHINES[mid].out[0])) fail('机器成品数量或品种损坏');
      job.products.forEach(item);
    }
  }
  // A seller's unsold object belongs to the queue, never to inventory at the same time.
  s.queue.slice(s.qi).forEach(c => { if (c.kind === 'sell' && c.item && !seen.has(c.item.uid)) item(c.item); });
  if (s.win.some(uid => !s.shelf.some(it => it.uid === uid))) fail('橱窗物品引用已丢失');
  for (const order of s.orders) if (!ITEMS[order.id] || !Number.isSafeInteger(order.qty) || order.qty < 1 || !Number.isSafeInteger(order.due) || order.due < 1 || !Number.isFinite(order.reward) || order.reward < 0) fail('旧订单记录损坏');
  if (s.v === 3) {
    const b = s.business;
    if (!obj(b) || !Array.isArray(b.warehouse) || !Array.isArray(b.purchases) || !Array.isArray(b.contracts) || !Array.isArray(b.ledger) || !Array.isArray(b.plans) || !obj(b.routes) || !obj(b.employee) || !obj(b.ownership) || !obj(b.reservations) || !nat(b.capacity) || b.warehouse.length > b.capacity || !nat(b.nextId) || b.nextId < 1 || !obj(b.marks)) fail('经营存档结构损坏');
    if (b.warehouse.some(it => !['water', 'fry', 'scrap', 'catnip', 'can'].includes(it.id))) fail('原料仓品种损坏');
    for (const list of [b.purchases, b.contracts]) {
      const ids = new Set();
      for (const record of list) { if (!obj(record) || typeof record.id !== 'string' || !record.id || ids.has(record.id)) fail('经营记录编号重复或丢失'); ids.add(record.id); }
    }
    for (const route of ['water', 'fish']) {
      const r = b.routes[route];
      if (!obj(r) || !nat(r.level) || r.level > 3 || !nat(r.completed) || !nat(r.level1Completed) || !nat(r.level2Completed) || !obj(r.markets) || !nat(r.markets.harbor) || !nat(r.markets.boutique) || typeof r.trial !== 'boolean' || typeof r.firstRegular !== 'boolean' || typeof r.recovery !== 'boolean') fail('客户成长记录损坏');
      if (r.levelHistory !== undefined && (!Array.isArray(r.levelHistory) || r.levelHistory.some(h => !obj(h) || !nat(h.day) || !nat(h.level) || h.level > 3))) fail('扩产生效记录损坏');
    }
    if (b.mainRoute !== null && !['water', 'fish'].includes(b.mainRoute) || !nat(b.employee.days) || typeof b.employee.hired !== 'boolean' || typeof b.employee.active !== 'boolean' || !Array.isArray(b.employee.delegated) || !Array.isArray(b.employee.results) || typeof b.ownership.owned !== 'boolean' || b.ownership.owned && (!nat(b.ownership.day) || b.ownership.day < 1)) fail('主营、员工或产权记录损坏');
    for (const p of b.purchases) if (!['water', 'fish'].includes(p.route) || !['ordered', 'blocked', 'received', 'cancelled'].includes(p.status) || !nat(p.qty) || p.qty < 1 || !Number.isFinite(p.price) || p.price < 0 || !nat(p.period) || p.period < 1 || !nat(p.arrivalDay) || p.arrivalDay < 1 || Math.floor((p.arrivalDay - 1) / 5) + 1 !== p.period) fail('采购记录损坏');
    for (const c of b.contracts) {
      if (c.managed !== undefined && typeof c.managed !== 'boolean') fail('合同托管标记损坏');
      if (c.closedDay !== undefined && (!nat(c.closedDay) || c.closedDay < 1 || c.closedDay > s.day)) fail('合同关闭日期损坏');
      if (!['water', 'fish'].includes(c.route) || !['trial', 'regular', 'harbor', 'boutique'].includes(c.kind) || !['active', 'completed', 'failed', 'cancelled'].includes(c.status) || !nat(c.qty) || c.qty < 1 || !nat(c.delivered) || c.delivered > c.qty || !nat(c.start) || c.start < 1 || !nat(c.due) || c.due < c.start || !Number.isFinite(c.price) || c.price < 0 || !Array.isArray(c.windows) || c.windows.length !== 2 || c.windows.some(n => !nat(n)) || c.windows[0] + c.windows[1] !== c.delivered || c.status === 'completed' && c.delivered !== c.qty) fail('客户合同记录损坏');
      if (c.kind === 'boutique' && (c.qty % 2 || c.windows.some(n => n > c.qty / 2))) fail('精品交货窗口损坏');
    }
    for (const row of b.ledger) if (!obj(row) || typeof row.id !== 'string' || !nat(row.day) || !Number.isFinite(row.amount) || !Number.isFinite(row.cost) || row.cost < 0 || typeof row.type !== 'string' || row.managed !== undefined && typeof row.managed !== 'boolean') fail('账本记录损坏');
    for (const plan of b.plans) if (!obj(plan) || !MACHINES[plan.machine] || !nat(plan.qty) || plan.qty < 1 || typeof plan.enabled !== 'boolean') fail('生产计划损坏');
    // Absence is the only compatible default. Existing invalid policies must never be reset.
    if (b.operations !== undefined) {
      const o = b.operations, modes = ['off', 'regular', 'harbor', 'boutique'];
      if (!obj(o) || o.v !== 1 || typeof o.enabled !== 'boolean' || !nat(o.reserve) || !obj(o.routes) || !modes.includes(o.routes.water) || !modes.includes(o.routes.fish)) fail('自动经营策略损坏或版本不支持');
      if (!obj(o.reports) || !Array.isArray(o.issues) || typeof o.status !== 'string') fail('自动经营报告损坏');
      for (const [key, row] of Object.entries(o.reports)) {
        if (!obj(row) || !nat(row.id) || row.id < 1 || String(row.id) !== key || row.start !== (row.id - 1) * 5 + 1 || row.end !== row.start + 4 || !Number.isFinite(row.income) || row.income < 0 || !Number.isFinite(row.spending) || row.spending < 0 || !nat(row.deliveries) || !nat(row.productionStarts) || !nat(row.purchases)) fail('自动经营周期报告损坏');
      }
      for (const issue of o.issues) if (!obj(issue) || issue.route !== undefined && !['water', 'fish'].includes(issue.route) || typeof issue.code !== 'string' || typeof issue.text !== 'string') fail('自动经营阻塞记录损坏');
    }
    for (const stage of ['morning', 'night']) if (b.marks[`operations-${stage}`] !== undefined && (!nat(b.marks[`operations-${stage}`]) || b.marks[`operations-${stage}`] > s.day)) fail('自动经营结算日期损坏');
    if (b.network !== undefined) validateNetwork(b.network, s.day, b.ownership);
    for (const [uid, contractId] of Object.entries(b.reservations)) if (!seen.has(Number(uid)) || !b.contracts.some(c => c.id === contractId && c.status === 'active')) fail('预留物品或合同引用丢失');
  }  if (s.v === 3 && (typeof s.runId !== 'string' || !s.runId || s.rulesetVersion !== 'growth-v1' || !s.persistence || !Number.isInteger(s.persistence.revision) || s.persistence.revision < 0 || !Array.isArray(s.persistence.commands) || s.persistence.commands.some(id => typeof id !== 'string'))) fail('新版本存档标记损坏');
  return s;
}
export function normalizeRun(raw, initialize = ensureGrowthState) {
  validateRun(raw);
  const next = clone(raw);
  if (next.v === 2) { next.v = 3; next.runId = createRunId(); next.rulesetVersion = 'growth-v1'; next.persistence = { revision: 0, commands: [] }; }
  initialize(next);
  validateRun(next);
  return rebindRun(next);
}
export function createPersistence({ storage, locks = globalThis.navigator?.locks, initialize = ensureGrowthState } = {}) {
  let writable = false, unlock = null, revisionRaw, busy = false;
  const storageAccess = () => storage === undefined ? globalThis.localStorage : storage;
  const read = key => { try { return storageAccess().getItem(key); } catch { throw new PersistenceError('无法读取存档，请检查浏览器存储权限'); } };
  const write = (key, raw) => { try { const target=storageAccess(); target.setItem(key, raw); if (target.getItem(key) !== raw) throw Error('readback'); } catch { throw new PersistenceError('未保存：存储空间不足或权限受限，请重试'); } };
  const assertWriter = () => { if (!writable) throw new PersistenceError('此页面为只读，请关闭另一游戏页面后重试', 'READ_ONLY'); };
  const assertFresh = () => { if (revisionRaw !== undefined && read(RUN_KEY) !== revisionRaw) throw new PersistenceError('存档已被其他页面更新，请重新载入', 'STALE_SAVE'); };
  const api = {
    get writable() { return writable; },
    async acquire() {
      if (writable) return true;
      if (!locks?.request) throw new PersistenceError('当前浏览器不支持安全写锁，无法保存；请使用新版浏览器', 'LOCK_UNAVAILABLE');
      return new Promise((resolve, reject) => { locks.request('mmdp_run_writer', { mode: 'exclusive', ifAvailable: true }, async lock => { if (!lock) { resolve(false); return; } writable = true; resolve(true); await new Promise(r => { unlock = r; }); writable = false; }).catch(reject); });
    },
    release() { writable = false; unlock?.(); unlock = null; },
    load() {
      const raw = read(RUN_KEY); revisionRaw = raw;
      if (raw === null) return null;
      let parsed; try { parsed = JSON.parse(raw); } catch { fail('存档内容损坏，原件已保留，不能自动开新局'); }
      const next = normalizeRun(parsed, initialize);
      if (parsed.v === 2) {
        assertWriter();
        const backup = `${RUN_KEY}_backup_v2`;
        const existing = read(backup);
        // Preserve the first original forever; a second source receives its own recoverable key.
        write(existing === null || existing === raw ? backup : `${backup}_${Date.now()}`, raw);
        const migrated = JSON.stringify(next); write(`${RUN_KEY}_migration_pending`, migrated);
        assertFresh(); write(RUN_KEY, migrated); revisionRaw = migrated;
      }
      return rebindRun(next);
    },
    save(state) {
      assertWriter(); assertFresh(); validateRun(state);
      if (state.v !== 3) throw new PersistenceError('请先完成存档迁移');
      const raw = JSON.stringify(state); write(RUN_KEY, raw); revisionRaw = raw; return true;
    },
    transactSync(live, commandId, mutate) {
      assertWriter(); if (busy) throw new PersistenceError('正在保存，请稍候', 'BUSY');
      if (!commandId || typeof commandId !== 'string') throw new PersistenceError('缺少操作编号');
      if (live.persistence.commands.includes(commandId)) return { state: live, duplicate: true };
      busy = true;
      try {
        assertFresh(); const draft = rebindRun(clone(live)); const result = mutate(draft);
        if (result?.then) throw new PersistenceError('同步事务不能执行异步操作');
        if (result?.ok === false) return { state: live, result, rejected: true };
        draft.persistence.commands.push(commandId); draft.persistence.commands = draft.persistence.commands.slice(-2048); draft.persistence.revision++;
        api.save(draft); return { state: rebindRun(clone(draft)), result, duplicate: false };
      } finally { busy = false; }
    },
    async transact(live, commandId, mutate) {
      assertWriter(); if (busy) throw new PersistenceError('正在保存，请稍候', 'BUSY');
      if (!commandId || typeof commandId !== 'string') throw new PersistenceError('缺少操作编号');
      if (live.persistence.commands.includes(commandId)) return { state: live, duplicate: true };
      busy = true;
      try {
        assertFresh(); const draft = rebindRun(clone(live)); const result = await mutate(draft);
        if (result?.ok === false) return { state: live, result, rejected: true };
        draft.persistence.commands.push(commandId); draft.persistence.commands = draft.persistence.commands.slice(-2048); draft.persistence.revision++;
        api.save(draft); return { state: rebindRun(clone(draft)), result, duplicate: false };
      } finally { busy = false; }
    },    remove() { assertWriter(); assertFresh(); try { storageAccess().removeItem(RUN_KEY); if (read(RUN_KEY) !== null) throw Error(); revisionRaw = null; } catch { throw new PersistenceError('未能删除存档，请重试'); } },
  };
  return api;
}






