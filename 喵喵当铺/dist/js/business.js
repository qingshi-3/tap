import * as Network from "./network.js";
import { MACHINES, ITEMS, WG, BUYOUT } from "./data.js";
export const ROUTES = {
  water: {
    name: "供水商",
    item: "water",
    machine: "purifier",
    unlock: 3,
    price: 8,
    sale: 44,
    trial: 3,
    base: 6,
    quotas: [12, 12, 24, 36],
    caps: [3, 3, 6, 9],
  },
  fish: {
    name: "鱼苗商",
    item: "fry",
    machine: "tank",
    unlock: 6,
    price: 12,
    sale: 56,
    trial: 2,
    base: 4,
    quotas: [8, 8, 16, 24],
    caps: [2, 4, 8, 12],
  },
};
export function ensureGrowthState(s) {
  s.persistence ||= { revision: 0, commands: [] };
  s.v = 3;
  s.rulesetVersion = "growth-v1";
  s.runId ||=
    globalThis.crypto?.randomUUID?.() ||
    `run-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  s.business ||= {
    warehouse: [],
    capacity: 12,
    purchases: [],
    contracts: [],
    routes: {
      water: {
        level: 0,
        completed: 0,
        level1Completed: 0,
        level2Completed: 0,
        trial: false,
        firstRegular: false,
        recovery: false,
        markets: { harbor: 0, boutique: 0 },
      },
      fish: {
        level: 0,
        completed: 0,
        level1Completed: 0,
        level2Completed: 0,
        trial: false,
        firstRegular: false,
        recovery: false,
        markets: { harbor: 0, boutique: 0 },
      },
    },
    mainRoute: null,
    employee: {
      hired: false,
      days: 0,
      active: false,
      pending: null,
      delegated: [],
      results: [],
      status: "",
    },
    reservations: {},
    ledger: [],
    ownership: { owned: false, day: null },
    plans: [],
    nextId: 1,
    marks: {},
  };
  if (!Object.prototype.hasOwnProperty.call(s.business, "operations"))
    s.business.operations = {
      v: 1,
      enabled: false,
      reserve: 150,
      routes: { water: "off", fish: "off" },
      reports: {},
      issues: [],
      status: "未开启",
    };
  Network.ensureNetworkState(s);
  return s;
}
const b = (s) => ensureGrowthState(s).business;
export const periodOf = (day) => ({
  id: Math.floor((day - 1) / 5) + 1,
  start: Math.floor((day - 1) / 5) * 5 + 1,
  end: Math.floor((day - 1) / 5) * 5 + 5,
});
const trading = (s, i) =>
  s.queue[s.qi]?.kind === "buy" && s.queue[s.qi]?.item?.uid === i.uid;
const supplyLevel = (s, route, day) => {
  const r = b(s).routes[route];
  return r.levelHistory
    ? Math.max(
        0,
        ...r.levelHistory.filter((h) => h.day <= day).map((h) => h.level),
      )
    : r.level;
};
export const reserved = (s, uid) => !!b(s).reservations[uid];
export const capacity = (s, mid) => {
  const r = Object.keys(ROUTES).find((k) => ROUTES[k].machine === mid);
  return r ? ROUTES[r].caps[supplyLevel(s, r, s.day)] : MACHINES[mid]?.cap;
};
export const rawItems = (s) => [...s.shelf, ...b(s).warehouse];
export const inventory = (s) => [
  ...s.shelf,
  ...b(s).warehouse,
  ...Object.values(s.machines).flatMap((j) =>
    j?.ready ? j.products || [] : [],
  ),
];
export function record(s, type, amount, cost = 0, detail = "") {
  const x = b(s);
  Network.recordLegacyMargin(s, type, amount, cost);
  x.ledgerTotals ||= {};
  x.ledgerTotals[type] ||= { amount: 0, cost: 0 };
  x.ledgerTotals[type].amount += amount;
  x.ledgerTotals[type].cost += cost;
  b(s).ledger.push({
    id: `l${b(s).nextId++}`,
    day: s.day,
    period: periodOf(s.day).id,
    type,
    amount,
    cost,
    detail,
  });
  if (b(s).ledger.length > 500) b(s).ledger.splice(0, b(s).ledger.length - 500);
}
export function detach(s, uid) {
  s.shelf = s.shelf.filter((i) => i.uid !== uid);
  s.hidden = s.hidden.filter((i) => i.uid !== uid);
  b(s).warehouse = b(s).warehouse.filter((i) => i.uid !== uid);
  s.win = s.win.filter((u) => u !== uid);
  for (const [mid, j] of Object.entries(s.machines)) {
    if (j?.products) {
      j.products = j.products.filter((i) => i.uid !== uid);
      j.n = j.products.length;
      if (!j.n) s.machines[mid] = null;
    }
  }
  delete b(s).reservations[uid];
}
const safe = (i) =>
  i.known === true &&
  !i.fake &&
  !i.stolen &&
  !ITEMS[i.id]?.ban &&
  (i.id !== "water" || i.gk || WG[i.g]?.eye);
const eligible = (s, c, i) =>
  !trading(s, i) &&
  safe(i) &&
  (!reserved(s, i.uid) || b(s).reservations[i.uid] === c.id) &&
  (c.route === "water" ? i.id === "water" && i.g >= 4 : i.id === "fish");
function offer(s, route, kind) {
  const x = b(s),
    r = x.routes[route],
    cfg = ROUTES[route],
    p = periodOf(s.day),
    start = kind === "trial" ? s.day + 1 : p.end + 1,
    level =
      x.mainRoute === route && !r.recovery ? supplyLevel(s, route, start) : 0;
  let qty =
      kind === "trial"
        ? cfg.trial
        : cfg.base * (level >= 2 ? 4 : level >= 1 ? 2 : 1),
    price = cfg.sale,
    reason = "";
  if (kind === "regular" && !r.firstRegular) qty = cfg.trial;
  if (kind === "harbor") {
    qty = route === "water" ? 36 : 24;
  }
  if (kind === "boutique") {
    qty = route === "water" ? 18 : 12;
    price = route === "water" ? 56 : 68;
  }
  if (s.day < cfg.unlock) reason = `第${cfg.unlock}天建立联系`;
  else if (!s.owned[cfg.machine]) reason = "需要对应机器";
  else if (
    kind === "trial" &&
    x.contracts.some(
      (c) =>
        c.route === route &&
        c.kind === "trial" &&
        c.status === "failed" &&
        periodOf(c.due).id >= p.id,
    )
  )
    reason = "下一期可重新试单";
  else if (kind === "trial" && r.trial) reason = "已完成试单";
  else if (kind !== "trial" && !r.trial) reason = "先完成试单";
  else if (
    kind !== "trial" &&
    kind !== "regular" &&
    (x.mainRoute !== route || r.level < 3 || r.recovery)
  )
    reason = "需要主营物流资格";
  else if (
    x.contracts.some(
      (c) =>
        c.route === route &&
        ((c.status === "active" && (c.kind === "trial" || kind === "trial")) ||
          (c.kind !== "trial" &&
            kind !== "trial" &&
            c.start === start &&
            c.status !== "cancelled")),
    )
  )
    reason = "已有该期合同";
  return {
    route,
    requirement: route === "water" ? "山泉水及以上·真货" : "鲜鱼·真货",
    kind,
    qty,
    price,
    start,
    due: kind === "trial" ? s.day + (route === "water" ? 4 : 5) : start + 4,
    eligible: !reason,
    visible:
      s.day >= cfg.unlock &&
      !!s.owned[cfg.machine] &&
      reason !== "已有该期合同" &&
      (kind === "trial"
        ? !r.trial
        : kind === "regular"
          ? r.trial
          : r.level2Completed >= 1),
    reason,
    fee: ["harbor", "boutique"].includes(kind) ? 60 : 0,
    rawCost: qty * cfg.price,
    filterCost: route === "water" ? qty : 0,
    productionDays: cfg.machine === "tank" ? 2 : 1,
    requiresRestart: qty > capacity(s, cfg.machine),
  };
}
function investments(s) {
  const x = b(s),
    total = Math.max(...Object.values(x.routes).map((r) => r.completed));
  return [
    {
      id: "warehouse",
      name: "扩建原料仓",
      cost: 100,
      description: "原料仓12→24格",
      eligible: x.capacity < 24,
      reason: x.capacity >= 24 ? "已扩建" : "",
    },
    ...Object.keys(ROUTES).flatMap((route) => {
      const r = x.routes[route];
      return [1, 2, 3].map((level) => {
        const id = route + (level === 3 ? "Logistics" : level),
          cost = [0, 160, 500, 600][level];
        let reason =
          r.level >= level
            ? "已购置"
            : r.level !== level - 1
              ? "先完成前级扩产"
              : level === 1 && r.completed < 1
                ? "完成一期对应路线正式合同"
                : level === 2 && r.level1Completed < 1
                  ? "扩产I后完成一期合同"
                  : level === 3 && r.level2Completed < 1
                    ? "扩产II后完成一期合同"
                    : x.mainRoute && x.mainRoute !== route
                      ? "先调整主营"
                      : "";
        return {
          id,
          name: `${route === "water" ? "水业" : "鱼业"}${level === 3 ? "物流" : `扩产${level}`}`,
          cost,
          description: `每期供料${ROUTES[route].quotas[level]}份 · 每批${ROUTES[route].caps[level]}份/${route === "water" ? 1 : 2}晚`,
          eligible: !reason,
          reason,
        };
      });
    }),
  ];
}
export function businessView(s, api) {
  const x = b(s),
    p = periodOf(s.day);
  return {
    day: s.day,
    period: p,
    warehouse: {
      items: x.warehouse,
      capacity: x.capacity,
      reserved: x.purchases
        .filter((o) => o.status === "ordered" || o.status === "blocked")
        .reduce((n, o) => n + o.qty, 0),
    },
    suppliers: Object.entries(ROUTES).map(([route, c]) => {
      const arrivalDay = s.day + 1,
        level = x.mainRoute === route ? supplyLevel(s, route, arrivalDay) : 0,
        target = periodOf(arrivalDay),
        orders = x.purchases.filter(
          (o) =>
            o.route === route &&
            o.period === target.id &&
            o.status !== "cancelled",
        ),
        used = orders.reduce((n, o) => n + o.qty, 0);
      return {
        route,
        name: c.name,
        unlocked: s.day >= c.unlock,
        price: c.price,
        quota: c.quotas[level],
        used,
        remaining: Math.max(0, c.quotas[level] - used),
        arrivalDay,
        period: target,
        batches: new Set(orders.map((o) => o.arrivalDay)).size,
      };
    }),
    purchases: x.purchases,
    contracts: x.contracts.map((c) => {
      const candidates = inventory(s)
        .filter((i) => eligible(s, c, i))
        .sort((a, b) => (a.g || 0) - (b.g || 0))
        .map((i) => ({
          ...i,
          name: i.id === "water" ? WG[i.g].n : ITEMS[i.id].name,
          location: s.shelf.includes(i)
            ? "shelf"
            : x.warehouse.includes(i)
              ? "warehouse"
              : "machine",
        }));
      return {
        ...c,
        requirement: c.route === "water" ? "山泉水及以上·真货" : "鲜鱼·真货",
        available: candidates.length,
        candidates,
        defaultUids: candidates
          .filter((i) => c.route !== "water" || i.g === 4)
          .slice(
            0,
            c.kind === "boutique"
              ? Math.max(0, c.qty / 2 - c.windows[s.day >= c.start + 3 ? 1 : 0])
              : c.qty - c.delivered,
          )
          .map((i) => i.uid),
      };
    }),
    offers: Object.keys(ROUTES).flatMap((r) =>
      ["trial", "regular", "harbor", "boutique"].map((k) => offer(s, r, k)),
    ),
    operations: operationsView(s, api),
    network: Network.networkView(s),
    progress: {
      staffRequired: 1,
      staffCompleted: Object.values(x.routes).reduce(
        (n, r) => n + r.completed,
        0,
      ),
      routeRequired: 1,
      routeCompleted: Object.fromEntries(
        Object.entries(x.routes).map(([route, r]) => [route, r.completed]),
      ),
    },
    routes: Object.fromEntries(
      Object.entries(x.routes).map(([route, r]) => {
        const effectiveLevel = supplyLevel(s, route, s.day),
          pending = (r.levelHistory || [])
            .filter((h) => h.day > s.day)
            .sort((a, b) => a.day - b.day);
        return [
          route,
          {
            ...r,
            effectiveLevel,
            pendingLevel: pending.length ? r.level : null,
            effectiveDay: pending[0]?.day ?? null,
          },
        ];
      }),
    ),
    mainRoute: x.mainRoute,
    pendingMain: x.pendingMain,
    employee: x.employee,
    ownership: x.ownership,
    ledger: x.ledger,
    ledgerTotals: x.ledgerTotals || {},
    investments: investments(s),
    plans: x.plans.map((plan) => ({
      ...plan,
      status: planStatus(s, plan, api),
    })),
    reservations: x.reservations,
    complete:
      x.ownership.owned &&
      Object.values(x.routes).some(
        (r) => r.level >= 2 && r.markets.harbor >= 2 && r.markets.boutique >= 2,
      ),
  };
}
// Plans specify recipe batches. Preserve the material/water split when taking a smaller batch.
function planInputUids(s, plan, preview) {
  const m = MACHINES[plan.machine],
    inputs = preview.inputUids
      .map((uid) => rawItems(s).find((i) => i.uid === uid))
      .filter(Boolean);
  const materials = inputs
    .filter((i) => i.id === m.in[0])
    .slice(0, plan.qty * m.in[1]);
  const waters = m.water
    ? inputs.filter((i) => i.id === "water").slice(0, plan.qty)
    : [];
  return [...materials, ...waters].map((i) => i.uid);
}
function planStatus(s, plan, api) {
  const e = b(s).employee,
    job = s.machines[plan.machine];
  if (job) return job.ready ? "成品待收" : `机器工作中，还需${job.left}晚`;
  if (!plan.enabled) return "计划已暂停";
  if (!e.hired) return "尚未招聘店员";
  if (e.days <= 0) return "工资到期，待续聘";
  if (!e.active) return e.pending?.active ? "次日上岗" : "店员已暂停";
  if (e.pending?.active === false && e.pending.day <= s.day)
    return "店员已暂停";
  const preview = api?.productionPlan(plan.machine);
  if (!preview) return "待检查原料";
  if (!preview.ok) return preview.reason;
  if (preview.batches < plan.qty) return `原料或滤芯不足，需要${plan.qty}份`;
  // Use the same explicit selection validation as actual production, including filter use.
  const exact = api.productionPlan(plan.machine, {
    uids: planInputUids(s, plan, preview),
  });
  return exact.ok ? "可安排今夜开工" : exact.reason;
}
const fail = (reason) => ({ ok: false, reason });
export function businessCommand(s, action, a = {}, api) {
  if (action === "networkBuild" || action === "networkPolicy" || action === "networkReception")
    return Network.networkCommand(s, action, a, {
      record: (...args) => record(s, ...args),
    });
  const x = b(s),
    view = businessView(s, api);
  if (action === "setOperations") {
    const routes = a.routes;
    if (
      typeof a.enabled !== "boolean" ||
      !Number.isSafeInteger(a.reserve) ||
      a.reserve < 0 ||
      !routes ||
      Object.keys(ROUTES).some(
        (route) =>
          !["off", "regular", "harbor", "boutique"].includes(routes[route]),
      )
    )
      return fail("经营安排无效");
    if (a.enabled && !x.employee.hired) return fail("先招聘店员");
    if (
      a.enabled &&
      Object.values(routes).every((kind) => kind === "off") &&
      !x.contracts.some((c) => c.managed && c.status === "active")
    )
      return fail("先安排一位客户");
    for (const route of Object.keys(ROUTES))
      if (a.enabled && routes[route] !== "off") {
        const r = x.routes[route];
        if (!r.trial) return fail("先完成该路线试单");
        if (
          ["harbor", "boutique"].includes(routes[route]) &&
          (x.mainRoute !== route || r.level < 3)
        )
          return fail("市场资格尚未开放");
      }
    delete x.marks["operations-morning"];
    delete x.marks["operations-night"];
    Object.assign(x.operations, {
      enabled: a.enabled,
      reserve: a.reserve,
      routes: { ...routes },
      issues: [],
      status: a.enabled ? "已安排" : "已关闭",
    });
    if (a.enabled)
      for (const p of x.plans)
        if (
          Object.keys(ROUTES).some(
            (route) =>
              routes[route] !== "off" && ROUTES[route].machine === p.machine,
          )
        )
          p.enabled = false;
    for (const c of x.contracts)
      if (
        c.status === "active" &&
        c.kind !== "trial" &&
        routes[c.route] !== "off" &&
        a.enabled
      )
        c.managed = true;
    return { ok: true };
  }
  if (action === "inspectStock") {
    if (s.phase !== "night") return fail("打烊后才能验货");
    const it = [...s.shelf, ...s.hidden, ...x.warehouse].find(
      (i) => i.uid === a.uid,
    );
    if (!it) return fail("物品已不在库存");
    it.known = true;
    it.est = null;
    if (it.id === "water") it.gk = true;
    if (it.stolen) it.stolenKnown = true;
    const name = it.id === "water" ? WG[it.g].n : ITEMS[it.id].name;
    const mislabeled = it.id === "water" && it.lab != null && it.lab > it.g;
    const notes = [
      it.fake ? "赝品" : mislabeled ? "标签虚标" : "真货",
      it.stolen ? "赃物" : null,
      ITEMS[it.id].ban ? "违禁品" : null,
    ].filter(Boolean);
    return {
      ok: true,
      inspection: {
        uid: it.uid,
        name,
        known: true,
        fake: !!(it.fake || mislabeled),
        stolen: !!it.stolen,
        ban: !!ITEMS[it.id].ban,
        ...(it.id === "water" ? { grade: it.g } : {}),
        text: `${name} · ${notes.join(" · ")}`,
      },
    };
  }
  if (action === "collectMachine") {
    if (s.phase !== "night") return fail("打烊后才能收取");
    if (!MACHINES[a.machine] || !s.machines[a.machine]?.ready)
      return fail("机器没有待收成品");
    const collected = api.collectMachines([], a.machine);
    return {
      ok: true,
      count: collected.length,
      remaining: s.machines[a.machine]?.n || 0,
    };
  }
  if (action === "purchase") {
    const q = view.suppliers.find((v) => v.route === a.route),
      qty = Number(a.qty);
    if (!q?.unlocked) return fail("供应尚未开放");
    if (!Number.isSafeInteger(qty) || qty < 1) return fail("数量无效");
    if (qty > q.remaining) return fail("本期额度不足");
    if (
      q.batches >= 2 &&
      !x.purchases.some(
        (o) =>
          o.route === a.route &&
          o.period === q.period.id &&
          o.arrivalDay === q.arrivalDay &&
          o.status !== "cancelled",
      )
    )
      return fail("本期最多两批到货");
    if (x.warehouse.length + view.warehouse.reserved + qty > x.capacity)
      return fail("原料仓容量不足");
    if (s.money < qty * q.price) return fail("鱼币不足");
    s.money -= qty * q.price;
    const o = {
      id: `p${x.nextId++}`,
      route: a.route,
      qty,
      price: q.price,
      period: q.period.id,
      arrivalDay: q.arrivalDay,
      status: "ordered",
    };
    x.purchases.push(o);
    record(s, "supplies", -qty * q.price, 0, a.route);
    return { ok: true, order: o };
  }
  if (action === "cancelPurchase") {
    const o = x.purchases.find((o) => o.id === a.id);
    if (!o || o.status !== "ordered" || o.arrivalDay <= s.day)
      return fail("订单已发货或已取消");
    o.status = "cancelled";
    s.money += o.qty * o.price;
    record(s, "refund", o.qty * o.price);
    return { ok: true };
  }
  if (action === "moveWarehouse") {
    const to = a.to || "warehouse",
      source = to === "warehouse" ? s.shelf : x.warehouse,
      ids =
        a.uids ||
        source
          .filter(
            (i) =>
              ["water", "fry", "scrap", "catnip", "can"].includes(i.id) &&
              !reserved(s, i.uid) &&
              !s.win.includes(i.uid),
          )
          .map((i) => i.uid);
    if (new Set(ids).size !== ids.length) return fail("选择重复");
    const items = ids.map((id) => source.find((i) => i.uid === id));
    if (
      items.some(
        (i) =>
          !i ||
          reserved(s, i.uid) ||
          s.win.includes(i.uid) ||
          (s.queue[s.qi]?.item?.uid === i.uid && s.queue[s.qi]?.kind === "buy"),
      )
    )
      return fail("商品正在使用或已预留");
    if (
      to === "warehouse" &&
      items.some(
        (i) => !["water", "fry", "scrap", "catnip", "can"].includes(i.id),
      )
    )
      return fail("不是生产原料");
    if (
      to === "warehouse"
        ? x.warehouse.length + view.warehouse.reserved + items.length >
          x.capacity
        : s.shelf.length + items.length > s.shelfCap
    )
      return fail("容量不足");
    for (const i of items) {
      detach(s, i.uid);
      (to === "warehouse" ? x.warehouse : s.shelf).push(i);
    }
    return { ok: true, count: items.length };
  }
  if (action === "acceptContract") {
    if (
      !ROUTES[a.route] ||
      !["trial", "regular", "harbor", "boutique"].includes(a.kind || "regular")
    )
      return fail("合同类型无效");
    const o = offer(s, a.route, a.kind || "regular");
    if (!o.eligible) return fail(o.reason);
    if (s.money < o.fee) return fail("物流费用不足");
    s.money -= o.fee;
    if (o.fee) record(s, "logistics", -o.fee);
    const c = {
      ...o,
      id: `c${x.nextId++}`,
      status: "active",
      delivered: 0,
      windows: [0, 0],
      level: x.mainRoute === a.route ? supplyLevel(s, a.route, o.start) : 0,
    };
    x.contracts.push(c);
    if (c.kind === "regular") x.routes[a.route].firstRegular = true;
    return { ok: true, contract: c };
  }
  if (action === "deliverContract" || action === "reserve") {
    const c = x.contracts.find((c) => c.id === a.id);
    if (!c || c.status !== "active" || s.day > c.due)
      return fail("合同不可交付");
    if (action === "deliverContract" && s.day < c.start)
      return fail("尚未到交货期");
    let remain = c.qty - c.delivered,
      window = 0;
    if (c.kind === "boutique") {
      window = s.day >= c.start + 3 ? 1 : 0;
      remain = c.qty / 2 - c.windows[window];
    }
    const candidates = inventory(s)
      .filter((i) => eligible(s, c, i))
      .sort(
        (u, v) =>
          (u.id === "water" ? u.g - v.g : 0) || (u.cost || 0) - (v.cost || 0),
      );
    const ids =
      a.uids ??
      candidates
        .filter((i) => c.route !== "water" || i.g === 4)
        .slice(0, remain)
        .map((i) => i.uid);
    if (
      !Array.isArray(ids) ||
      !ids.length ||
      new Set(ids).size !== ids.length ||
      ids.length > remain
    )
      return fail("交付数量无效");
    const items = ids.map((id) => candidates.find((i) => i.uid === id));
    if (items.some((i) => !i)) return fail("需要已知真货且未被其他用途占用");
    if (action === "reserve") {
      for (const i of items) x.reservations[i.uid] = c.id;
      return { ok: true, count: items.length };
    }
    const revenue = items.length * c.price,
      cost = items.reduce((n, i) => n + (i.cost || 0), 0);
    items.forEach((i) => detach(s, i.uid));
    s.money += revenue;
    c.delivered += items.length;
    c.windows[window] += items.length;
    record(s, "contract", revenue, cost, c.id);
    if (c.delivered === c.qty) finish(s, c, true);
    return { ok: true, count: items.length, revenue, cost };
  }
  if (action === "release") {
    for (const uid of a.uids || []) delete x.reservations[uid];
    return { ok: true };
  }
  if (action === "cancelContract") {
    const c = x.contracts.find((c) => c.id === a.id);
    if (!c || c.status !== "active") return fail("合同已关闭");
    if (s.day < c.start && c.kind !== "trial") {
      c.status = "cancelled";
      c.closedDay = s.day;
      if (c.fee) {
        s.money += c.fee;
        record(s, "refund", c.fee);
      }
    } else finish(s, c, false);
    releaseContract(s, c);
    return { ok: true };
  }
  if (action === "invest") {
    const i = view.investments.find((i) => i.id === a.id);
    if (a.id?.startsWith("switch")) {
      const route = a.id === "switchWater" ? "water" : "fish";
      if (
        x.contracts.some(
          (c) => c.status === "active" && c.due > periodOf(s.day).end,
        ) ||
        x.purchases.some((o) => ["ordered", "blocked"].includes(o.status)) ||
        ["purifier", "tank"].some((mid) => s.machines[mid])
      )
        return fail("先完成跨期合同、加工和在途采购");
      x.pendingMain = { route, day: periodOf(s.day).end + 1 };
      return { ok: true };
    }
    if (!i?.eligible) return fail(i?.reason || "投资不存在");
    if (s.money < i.cost) return fail("鱼币不足");
    s.money -= i.cost;
    record(s, "investment", -i.cost, 0, i.id);
    if (i.id === "warehouse") x.capacity = 24;
    else {
      const route = i.id.startsWith("water") ? "water" : "fish";
      x.mainRoute ||= route;
      const r = x.routes[route];
      r.levelHistory ||= [{ day: 0, level: r.level }];
      r.level = i.id.endsWith("Logistics")
        ? 3
        : Number(i.id.slice(route.length));
      r.levelHistory.push({ day: periodOf(s.day).end + 1, level: r.level });
      if (x.routes[route].level === 3) x.capacity = Math.max(36, x.capacity);
    }
    return { ok: true };
  }
  if (action === "hire" || action === "renew") {
    if (
      !x.employee.hired &&
      Object.values(x.routes).reduce((n, r) => n + r.completed, 0) < 1
    )
      return fail("完成一期正式合同后招聘");
    const cost = x.employee.hired ? 30 : 110;
    if (s.money < cost) return fail("鱼币不足");
    s.money -= cost;
    record(s, "wage", -cost);
    x.employee.hired = true;
    x.employee.days += 5;
    x.employee.pending = { active: true, day: s.day + 1 };
    return { ok: true };
  }
  if (action === "employeePause") {
    if (!x.employee.hired) return fail("尚未招聘");
    x.employee.pending = { active: !a.paused, day: s.day + 1 };
    return { ok: true };
  }
  if (action === "delegate") {
    const it = s.shelf.find((i) => i.uid === a.uid);
    if (
      !it ||
      !safe(it) ||
      (it.id === "water" && it.lab != null && it.lab > it.g) ||
      reserved(s, it.uid)
    )
      return fail("只能委托已知普通真货");
    if (a.enabled !== false && (!Number.isFinite(a.minPrice) || a.minPrice < 1))
      return fail("最低价无效");
    x.employee.delegated = x.employee.delegated.filter((d) => d.uid !== a.uid);
    if (a.enabled !== false) {
      x.employee.delegated.push({
        uid: a.uid,
        minPrice: Math.ceil(a.minPrice),
      });
    }
    return { ok: true };
  }
  if (action === "plan") {
    if (
      managedRoute(
        s,
        Object.keys(ROUTES).find(
          (route) => ROUTES[route].machine === a.machine,
        ),
      )
    )
      return fail("供货托管中，先关闭该路线托管");
    if (!MACHINES[a.machine] || !s.owned[a.machine])
      return fail("机器尚未购置");
    if (
      !Number.isSafeInteger(a.qty) ||
      a.qty < 1 ||
      a.qty > capacity(s, a.machine)
    )
      return fail("批量超出产能");
    x.plans =
      a.enabled === false
        ? []
        : [
            {
              machine: a.machine,
              qty: a.qty,
              purpose: a.purpose || "contract",
              enabled: true,
              status: "待照看",
            },
          ];
    return { ok: true };
  }
  if (action === "buyout") {
    if (x.ownership.owned) return fail("店铺已属于你");
    const cost = BUYOUT + (s.rentDue || 0);
    if (s.money < cost) return fail("产权款及欠租不足");
    s.money -= cost;
    record(s, "ownership", -cost);
    s.rentDue = 0;
    x.ownership = { owned: true, day: s.day };
    s.st.firstBuyoutDay ||= s.day;
    return { ok: true, cost };
  }
  return fail("未知经营操作");
}
function releaseContract(s, c) {
  for (const [uid, id] of Object.entries(b(s).reservations))
    if (id === c.id) delete b(s).reservations[uid];
}
function finish(s, c, success) {
  c.closedDay = s.day;
  const r = b(s).routes[c.route];
  c.status = success ? "completed" : "failed";
  if (c.kind === "trial") {
    if (success) r.trial = true;
  } else if (success) {
    r.completed++;
    if (c.level >= 1) r.level1Completed++;
    if (c.level >= 2) r.level2Completed++;
    if (r.recovery) r.recovery = false;
    if (r.markets[c.kind] !== undefined) r.markets[c.kind]++;
  } else r.recovery = true;
  releaseContract(s, c);
}
export function morning(s, api) {
  const x = b(s);
  if (x.pendingMain && s.day >= x.pendingMain.day) {
    x.mainRoute = x.pendingMain.route;
    x.pendingMain = null;
  }
  if (x.employee.pending && s.day >= x.employee.pending.day) {
    x.employee.active = x.employee.pending.active;
    x.employee.pending = null;
  }
  for (const o of x.purchases) {
    if (!["ordered", "blocked"].includes(o.status) || o.arrivalDay > s.day)
      continue;
    if (x.warehouse.length + o.qty > x.capacity) {
      o.status = "blocked";
      continue;
    }
    for (let n = 0; n < o.qty; n++)
      x.warehouse.push(
        api.mkItem(ROUTES[o.route].item, {
          cost: o.price,
          q: 1,
          known: true,
          ...(o.route === "water" ? { g: 2, gk: true, lab: null } : {}),
        }),
      );
    o.status = "received";
  }
}
export function employeeSales(s, api) {
  const x = b(s),
    e = x.employee;
  if (x.marks.sales === s.day || !e.active || e.days <= 0) return;
  x.marks.sales = s.day;
  e.results = [];
  let count = 0;
  for (const c of s.queue) {
    if (count >= 2) break;
    if (c.kind !== "buy" || c.hoarder || c.story || api.observationClue(c))
      continue;
    const clue = api.observationClue(c);
    if (clue && typeof clue === "object" && clue.suspicious) continue;
    const d = e.delegated.find((d) => {
      const i = s.shelf.find((i) => i.uid === d.uid);
      return (
        i &&
        safe(i) &&
        !(i.id === "water" && i.lab != null && i.lab > i.g) &&
        !reserved(s, i.uid) &&
        api.wants(c, i) &&
        s.queue[s.qi]?.item?.uid !== i.uid
      );
    });
    if (!d) continue;
    const i = s.shelf.find((i) => i.uid === d.uid);
    api.buyerLooks(c, i);
    if (c.bid < d.minPrice) {
      delete c.item;
      continue;
    }
    const price = c.bid;
    api.sellItem(c, price);
    c.employeeSold = true;
    e.results.push({ uid: i.uid, price, who: c.who });
    e.delegated = e.delegated.filter((v) => v.uid !== i.uid);
    count++;
  }
  s.queue = s.queue.filter((c) => !c.employeeSold);
}
export function evening(s, api) {
  const x = b(s);
  if (x.marks.evening === s.day) return false;
  x.marks.evening = s.day;
  api.collectMachines();
  runOperations(s, api, "night");
  for (const c of x.contracts) {
    if (c.status !== "active") continue;
    if (
      c.kind === "boutique" &&
      s.day === c.start + 2 &&
      c.windows[0] < c.qty / 2
    )
      c.firstMissed = true;
    if (c.due <= s.day) finish(s, c, false);
  }
  api.collectMachines();
  const e = x.employee;
  if (e.active && e.days > 0) {
    const p = x.plans[0];
    if (
      p?.enabled &&
      !managedRoute(
        s,
        Object.keys(ROUTES).find(
          (route) => ROUTES[route].machine === p.machine,
        ),
      )
    ) {
      const candidates = api.productionPlan(p.machine);
      const m = MACHINES[p.machine],
        needed = p.qty * (m.in[1] + (m.water ? 1 : 0));
      const ids = planInputUids(s, p, candidates);
      p.status =
        ids.length === needed && api.runMachine(p.machine, { uids: ids })
          ? "已开工"
          : candidates.reason || "原料不足，计划未开工";
    }
    e.days--;
  }
  return true;
}
const managedRoute = (s, route) => {
  if (!route) return false;
  const o = b(s).operations;
  return (
    o.enabled &&
    (o.routes[route] !== "off" ||
      b(s).contracts.some(
        (c) => c.route === route && c.managed && c.status === "active",
      ))
  );
};
const opsFloor = (s, api) =>
  b(s).operations.reserve + (api?.rentInfo?.().amount || 0);
function opsReport(s) {
  const o = b(s).operations,
    p = periodOf(s.day);
  return (o.reports[p.id] ||= {
    ...p,
    income: 0,
    spending: 0,
    deliveries: 0,
    productionStarts: 0,
    purchases: 0,
  });
}
function operationsView(s, api) {
  const x = b(s),
    o = x.operations,
    e = x.employee,
    floor = opsFloor(s, api),
    canRenew = e.active && s.money - floor >= 30;
  const reason = !e.hired
    ? "先招聘店员"
    : !e.active
      ? "店员已暂停"
      : o.enabled &&
          Object.values(o.routes).every((k) => k === "off") &&
          !x.contracts.some((c) => c.managed && c.status === "active")
        ? "待安排客户"
        : e.days <= 0 && !canRenew
          ? "工资不足，待续聘"
          : "";
  return {
    ...o,
    available: !reason,
    reason: reason || o.issues[0]?.text || "",
    cashFloor: floor,
    previousPeriod: o.reports[periodOf(s.day).id - 1] || null,
    period: {
      ...periodOf(s.day),
      income: 0,
      spending: 0,
      deliveries: 0,
      productionStarts: 0,
      purchases: 0,
      ...o.reports[periodOf(s.day).id],
    },
    options: Object.fromEntries(
      Object.keys(ROUTES).map((route) => [
        route,
        ["regular", "harbor", "boutique"].map((kind) => {
          const r = x.routes[route],
            quote = offer(s, route, r.recovery ? "regular" : kind),
            signed = x.contracts.some(
              (c) =>
                c.route === route &&
                c.kind !== "trial" &&
                c.start === periodOf(s.day).end + 1 &&
                c.status !== "cancelled",
            ),
            reason = !r.trial
              ? "先完成该路线试单"
              : !s.owned[ROUTES[route].machine]
                ? "需要对应机器"
                : kind !== "regular" && (x.mainRoute !== route || r.level < 3)
                  ? "需要主营物流资格"
                  : "";
          return {
            ...quote,
            kind,
            quotedKind: quote.kind,
            eligible: !reason,
            reason,
            revenue: quote.qty * quote.price,
            filterExpense: quote.filterCost * 3,
            days: 5,
            text: [
              r.recovery
                ? "恢复期按固定客户履约"
                : quote.kind === "boutique"
                  ? "第3、5天分别交一半"
                  : "第5天前交齐",
              signed ? "下期已签，调整只作用之后未签期" : "",
            ]
              .filter(Boolean)
              .join(" · "),
          };
        }),
      ]),
    ),
  };
}
// Called inside the same durable transaction as the surrounding day/night transition.
export function runOperations(s, api, stage = "morning") {
  const x = b(s),
    o = x.operations,
    e = x.employee;
  if (!o.enabled) return { ok: false, reason: "自动经营已关闭" };
  const mark = `operations-${stage}`;
  if (x.marks[mark] === s.day && !o.issues.length)
    return { ok: true, duplicate: true };
  x.marks[mark] = s.day;
  o.issues = [];
  const issue = (route, code, text) => {
    if (!o.issues.some((i) => i.route === route && i.code === code))
      o.issues.push({ ...(route ? { route } : {}), code, text });
  };
  const report = opsReport(s),
    floor = () => opsFloor(s, api);
  for (const id of Object.keys(o.reports))
    if (Number(id) < periodOf(s.day).id - 1) delete o.reports[id];
  const perform = (fn, counter) => {
    const money = s.money,
      ledgerId = x.nextId,
      result = fn();
    if (result?.ok === false || result === false) return result;
    const delta = s.money - money;
    if (delta > 0) report.income += delta;
    else report.spending -= delta;
    if (counter) report[counter]++;
    for (const entry of x.ledger)
      if (Number(entry.id.slice(1)) >= ledgerId) entry.managed = true;
    return result;
  };
  const spend = (cost, fn, counter, route) => {
    if (s.money - cost < floor()) {
      issue(route, "cash", `保留${floor()}鱼币，当前资金不足`);
      return false;
    }
    return perform(fn, counter);
  };
  if (!e.hired || !e.active) {
    o.status = !e.hired ? "先招聘店员" : "店员已暂停";
    issue(null, "employee", o.status);
    return { ok: false, reason: o.status };
  }
  const routes = Object.keys(ROUTES).sort((a, bRoute) =>
    a === x.mainRoute ? -1 : bRoute === x.mainRoute ? 1 : 0,
  );
  const contracts = () =>
    x.contracts.filter((c) => c.managed && c.status === "active");
  // Batch delivery chooses only public, known genuine baseline stock; premium water is never implicit.
  const deliverManaged = () => {
    for (const c of contracts())
      if (s.day >= c.start && s.day <= c.due) {
        const available = inventory(s).filter(
          (i) =>
            eligible(s, c, i) &&
            !s.win.includes(i.uid) &&
            (c.route !== "water" || i.g === 4),
        );
        let limit = c.qty - c.delivered;
        if (c.kind === "boutique")
          limit = c.qty / 2 - c.windows[s.day >= c.start + 3 ? 1 : 0];
        const uids = available.slice(0, limit).map((i) => i.uid);
        if (uids.length)
          perform(
            () =>
              businessCommand(s, "deliverContract", { id: c.id, uids }, api),
            "deliveries",
          );
      }
  };
  if (e.days > 0) deliverManaged();
  if (
    Object.values(o.routes).every((kind) => kind === "off") &&
    !contracts().length
  ) {
    o.status = "待安排客户";
    return { ok: true, reason: o.status };
  }
  if (
    e.days <= 1 &&
    !spend(30, () => businessCommand(s, "renew", {}, api), null, null)
  ) {
    o.status = e.days <= 0 ? "工资到期" : "工资即将到期";
    if (e.days <= 0) return { ok: false, reason: o.status };
  }
  if (e.days <= 0) return { ok: false, reason: "工资到期" };
  deliverManaged();
  if (stage === "night" && s.day === periodOf(s.day).end) {
    for (const route of routes) {
      const kind = o.routes[route];
      if (kind === "off") continue;
      const priorRecovery = x.routes[route].recovery,
        closingFailure = contracts().some(
          (c) => c.route === route && c.due === s.day && c.delivered < c.qty,
        );
      if (closingFailure) x.routes[route].recovery = true;
      let quote = offer(s, route, kind);
      if (x.routes[route].recovery) quote = offer(s, route, "regular");
      if (
        x.contracts.some(
          (c) =>
            c.route === route &&
            c.kind !== "trial" &&
            c.start === quote.start &&
            c.status !== "cancelled",
        )
      ) {
        x.routes[route].recovery = priorRecovery;
        continue;
      }
      if (!quote.eligible) {
        issue(route, "contract", quote.reason);
        x.routes[route].recovery = priorRecovery;
        continue;
      }
      const signed = spend(
        quote.fee,
        () =>
          businessCommand(
            s,
            "acceptContract",
            { route, kind: quote.kind },
            api,
          ),
        null,
        route,
      );
      if (signed?.ok) signed.contract.managed = true;
      x.routes[route].recovery = priorRecovery;
    }
  }
  // One machine batch at a time. Delivery above frees ready products before procurement is computed.
  const starts = [];
  for (const route of [...routes].sort((a, b) =>
    ROUTES[b].machine === "tank" ? 1 : ROUTES[a].machine === "tank" ? -1 : 0,
  )) {
    if (!managedRoute(s, route)) continue;
    const cfg = ROUTES[route],
      active = contracts().filter((c) => c.route === route && c.due >= s.day);
    if (!active.length) continue;
    const need = active.reduce(
        (n, c) =>
          n +
          (c.kind === "boutique" && s.day >= c.start + 3
            ? c.qty / 2 - c.windows[1]
            : c.qty - c.delivered),
        0,
      ),
      usable = (i) =>
        safe(i) &&
        !(i.id === "water" && i.lab != null && i.lab > i.g) &&
        !s.win.includes(i.uid) &&
        !trading(s, i) &&
        (!reserved(s, i.uid) ||
          active.some((c) => c.id === x.reservations[i.uid]));
    const products = inventory(s).filter(
      (i) =>
        usable(i) &&
        (route === "water" ? i.id === "water" && i.g === 4 : i.id === "fish"),
    ).length;
    const raw = rawItems(s).filter(
      (i) =>
        usable(i) &&
        !reserved(s, i.uid) &&
        (route === "water" ? i.id === "water" && i.g === 2 : i.id === "fry"),
    );
    const job = s.machines[cfg.machine],
      underway = job && !job.ready ? job.n : 0,
      inbound = x.purchases
        .filter(
          (p) => p.route === route && ["ordered", "blocked"].includes(p.status),
        )
        .reduce((n, p) => n + p.qty, 0);
    let missing = Math.max(
      0,
      need - products - raw.length - underway - inbound,
    );
    if (missing) {
      const supplier = businessView(s, api).suppliers.find(
          (v) => v.route === route,
        ),
        v = businessView(s, api);
      const space = x.capacity - x.warehouse.length - v.warehouse.reserved;
      const affordable = Math.max(
        0,
        Math.floor((s.money - floor()) / cfg.price),
      );
      const qty = Math.min(missing, supplier.remaining, space, affordable);
      if (qty > 0) {
        const order = perform(
          () => businessCommand(s, "purchase", { route, qty }, api),
          "purchases",
        );
        if (!order?.ok) issue(route, "supply", order.reason);
      } else if (space <= 0 && !raw.length && !underway)
        issue(route, "warehouse", "原料仓已满");
      else if (affordable <= 0)
        issue(route, "cash", `保留${floor()}鱼币，采购资金不足`);
      else if (!supplier.remaining) issue(route, "quota", "本期供货额度已用完");
    }
    if (stage !== "night" || job || need <= products) continue;
    const count = Math.min(
      capacity(s, cfg.machine),
      raw.length,
      need - products,
    );
    if (!count) continue;
    if (route === "water" && s.filter < count) {
      const packs = Math.ceil((count - s.filter) / 10);
      for (let k = 0; k < packs; k++) {
        if (!spend(30, () => ({ ok: api.buyFilter() }), null, route)) break;
      }
      if (s.filter < count) {
        issue(route, "filter", "滤芯不足");
        continue;
      }
    }
    const ids = raw.slice(0, count).map((i) => i.uid),
      plan = api.productionPlan(cfg.machine, { uids: ids });
    if (!plan.ok) {
      issue(route, "production", plan.reason);
      continue;
    }
    starts.push({ route, machine: cfg.machine, ids });
  }
  for (const next of starts.sort((a, b) =>
    a.route === x.mainRoute ? -1 : b.route === x.mainRoute ? 1 : 0,
  ))
    perform(
      () => ({ ok: !!api.runMachine(next.machine, { uids: next.ids }) }),
      "productionStarts",
    );
  o.status = o.issues.length ? o.issues[0].text : "按安排经营";
  return { ok: !o.issues.length, reason: o.status };
}
